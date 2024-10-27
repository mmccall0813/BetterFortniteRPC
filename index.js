const axios = require("axios");
const follow = require("text-file-follower");
const path = require("path");
const RPC = require("discord-rpc");
const fs = require("fs");
const crypto = require("crypto");
const lastfm = require("simple-lastfm");
const io = require("socket.io-client").io;
const prompt = require("prompt-sync")();

let sparktracks = "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks";

if(!fs.existsSync("./config.json")) fs.copyFileSync("./config.example.json", "./config.json");
let config = require("./config.json");

let analyticsConsent = "";

if(config.firstrun && !config.analytics.enable){
    console.log("Would you like to opt in to analytics?");
    console.log("The data collected includes: what song you are currently playing, your selected instrument and difficulty, and how long you've spent playing specific songs");
    console.log("This data is used to see whats popular among festival players.");
    console.log("The collected data is associated to an identifier (which is by default \"anonymous\"), and cannot be traced back to you unless you change said identifier");

    while(analyticsConsent[0] !== "y" && analyticsConsent[0] !== "n"){
        analyticsConsent = prompt("(y/n) ");
    }

    if(analyticsConsent[0] === "y"){
        config.analytics.enable = true;
        let identifier = prompt("Please enter your preferred identifier, or hit enter to set it to anonymous:");
        config.analytics.identifier = (identifier === "" ? "anonymous" : identifier);
        console.log("Thank you! If you ever want to opt out, set \"enable\" to false in config.json");
    } else {
        config.analytics.enable = false;
    }

    config.firstrun = false;

    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}

console.log("grabbing festival tracklist...")

let tracks = {};

axios.get(sparktracks).then( async (res) => {
    tracks = res.data;
    console.log("done grabbing tracklist, ready to broadcast status");
});

if(config.lastfm.scrobbling && config.lastfm.password !== ""){
    console.log("removing password from config and generating authToken...");
    config.lastfm.authToken = crypto.createHash("md5").update(config.lastfm.username + crypto.createHash("md5").update(config.lastfm.password).digest("hex")).digest("hex");
    config.lastfm.password = "";
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}

let fm = new lastfm({
    api_key: config.lastfm.api_key,
    api_secret: config.lastfm.api_secret,
    username: config.lastfm.username,
    authToken: config.lastfm.authToken,
    session_key: config.lastfm.session_key
});

if(config.lastfm.scrobbling){
    if(!config.lastfm.session_key){
        console.log("attemping lastfm login...");
        fm.getSessionKey((res) => {
            if(res.success){
                console.log("successful lastfm login! saving session key...")
                config.lastfm.session_key = res.session_key;
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
            } else {
                console.log("Failed!");
                console.log(res.error);
            }
        });
    } else {
        console.log("reusing lastfm existing session key...")
    }
}

let logfile = path.resolve(process.env.USERPROFILE + "\\AppData\\Local\\FortniteGame\\Saved\\Logs\\FortniteGame.log");

let state = {song: "", instrument: "", difficulty: "", stage: "", timestamp: Date.now()};
let lastFestivalRelatedEvent = 0;
let socket;

if(config.analytics.enable){
    console.log("connecting to analytics server...")
    // socket = io("ws://localhost:8924");
    socket = io("ws://festrpc.highwi.re:8924");

    socket.on("connect", () => {
        console.log("connected to analytics server");
        socket.emit("identify", config.analytics.identifier);
    })
}

let follower = follow(logfile);

// watch logfile
follower.on("line", followerLine);

// checks the filesize, if its smaller than last time, restart the log file watcher
let curSize = fs.statSync(logfile).size;
let restartCheckCounter = 0;
fs.watch(logfile, (eventType, fileName) => {
    if(restartCheckCounter % 100 !== 0){
        restartCheckCounter++;
        return;
    }
    restartCheckCounter = 0;
    
    if(fs.statSync(logfile).size < curSize){
        console.log("detected game restart, restarting log watcher...");
        curSize = fs.statSync(logfile).size;
        follower.close();
        follower = follow(logfile);
        follower.on("line", followerLine)
    }

})

function followerLine(name, line) {
    let withoutTimestamp = line.split("]").slice(2).join("]");

    if(withoutTimestamp.toLowerCase().includes("pilgrim")){ 
        lastFestivalRelatedEvent = Date.now();
        // if(withoutTimestamp.startsWith("LogPilgrim")) console.log(line); // for testing purposes
    }

    if(withoutTimestamp.startsWith("LogPilgrimGameEvaluator: UPilgrimGameEvaluator::SetDifficultyAndGetGems")){
        let info = withoutTimestamp.replace("LogPilgrimGameEvaluator: UPilgrimGameEvaluator::SetDifficultyAndGetGems: ", "");
        let difficulty = info.split("EPilgrimSongDifficulty::Difficulty")[1].split(" ")[0];
        let instrument = info.split("EPilgrimTrackType::Track")[1].split(" ")[0].replace("Plastic", "Pro ").replace("Drum", "Drums").replace("Guitar", "Lead"); // this is a semi shitty way to do this but it works

        console.log("detected " + instrument + " on " + difficulty);

        let song = state.song;
        if(!song){
            console.log("couldn't find song id... did you start the script starting a song?");
            return;
        }

        state.instrument = instrument;
        state.difficulty = difficulty;
        state.stage = "playing";

        if(config.lastfm.scrobbling){
            let halflen = tracks[state.song].track.dn / 2;
            console.log(`waiting ${halflen} seconds (half song length) before scrobbling ${tracks[state.song].track.tt}`);
            setTimeout( () => {
                if(state.song === song && state.stage === "playing"){
                    console.log(`scrobbling ${tracks[state.song].track.tt}...`);
                    fm.scrobbleTrack({artist: tracks[state.song].track.an, track: tracks[state.song].track.tt, callback: (res) => {
                        console.log("scrobble complete, api response: " + JSON.stringify(res));
                    }});
                }
            }, halflen * 1000)
        }
        if(config.analytics.enable){
            console.log("sending startSong event to analytics server");
            socket.emit("startSong", state.song, state.instrument, state.difficulty);
        }

        state.timestamp = Date.now();
        updateStatus();
    }

    if(withoutTimestamp === "LogPilgrimGame: UPilgrimGame::StopSong"){
        state.stage = "";

        if(config.analytics.enable){
            console.log("sending stopSong event to analytics server");
            socket.emit("stopSong");
        }

        console.log("song stopped")

        updateStatus();
    }

    if(withoutTimestamp.startsWith("LogPilgrimFTUEControllerComponent: UPilgrimFTUEControllerComponent::EndPlay")){
        state.stage = "";

        updateStatus();
    }

    if(withoutTimestamp.startsWith("LogPilgrimMediaStreamer: UPilgrimMediaStreamer::PrepareSong:")){
        let song = withoutTimestamp.replace("LogPilgrimMediaStreamer: UPilgrimMediaStreamer::PrepareSong: Preparing song ", "");

        state.song = song;

        console.log("starting song " + song);


        state.timestamp = Date.now();
        updateStatus();
    }
    
    if(withoutTimestamp.startsWith("LogPilgrimQuickplayStateMachine")){
        
        let leaving = withoutTimestamp.includes("Leaving ");
        let feststate = withoutTimestamp.split("Pilgrim Quickplay state ")[1];
        
        // console.log(`now ${leaving ? "leaving" : "in"} fest state ` + feststate); // spams logs too much
        switch(feststate){
            case "EPilgrimQuickplayState::Pregame":
                if(leaving){
                    console.log("clearing backstage status");
                    state.stage = "";
                } else {
                    console.log("setting status to backstage");
                    state.stage = "pregame";
                    state.timestamp = Date.now();
                }
                updateStatus();
            break;
            case "EPilgrimQuickplayState::SongResults":
                if(leaving){
                    console.log("clearing results status")
                    state.stage = "";
                } else {
                    console.log("setting status to results");
                    state.stage = "results";
                    state.timestamp = Date.now();
                }
                updateStatus();
            break;
            case "EPilgrimQuickplayState::Preintro":
            case "EPilgrimQuickplayState::Intro":
                if(leaving){
                    // do nothing
                } else {
                    state.stage = "intro";
                    updateStatus();
                }
            break;
        }
    }
}

let flipper = false;
setInterval( () => {
    flipper = !flipper;

    updateStatus();
}, 5000)

const rpc = new RPC.Client({"transport": "ipc"});

function updateStatus(){
    switch(state.stage){
        case "playing":
            rpc.setActivity( {
                "details": tracks[state.song].track.an + " - " + tracks[state.song].track.tt + `${flipper ? "" : "​"}`,
                "state": state.instrument + " on " + state.difficulty,
                "largeImageKey": tracks[state.song].track.au,
                "largeImageText": "FestivalRPC by mmccall0813 on GitHub",
                "startTimestamp": state.timestamp
            });
        break;
        case "pregame":
            rpc.setActivity( {
                "details": "Backstage" + `${flipper ? "" : "​"}`,
                "state": "Choosing what to play...",
                "largeImageKey": "festlogo",
                "largeImageText": "FestivalRPC by mmccall0813 on GitHub",
                "startTimestamp": state.timestamp
            })
        break;
        case "results":
            rpc.setActivity( {
                "details": "Song Results" + `${flipper ? "" : "​"}`,
                "state": tracks[state.song].track.tt + ` | ${state.difficulty} ${state.instrument}`,
                "largeImageKey": tracks[state.song].track.au,
                "largeImageText": "FestivalRPC by mmccall0813 on GitHub",
                "startTimestamp": state.timestamp
            })
        break;
        case "intro":
            rpc.setActivity( {
                "details": "Starting a song..." + `${flipper ? "" : "​"}`,
                "largeImageKey": "festlogo",
                "largeImageText": "FestivalRPC by mmccall0813 on GitHub",
                "startTimestamp": state.timestamp
            })
        break;
        case "":
            setTimeout( () => {
                if(state.stage === "") rpc.clearActivity();
            }, 5000)
        break;
    }
}

rpc.login({ clientId: "1299298877203157095" })