const axios = require("axios");
const follow = require("text-file-follower");
const path = require("path");
const RPC = require("discord-rpc");

let sparktracks = "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks";

console.log("grabbing festival tracklist...")

let tracks = {};

axios.get(sparktracks).then( async (res) => {
    tracks = res.data;
    console.log("done! ready to rock!");
});

let logfile = path.resolve(process.env.USERPROFILE + "\\AppData\\Local\\FortniteGame\\Saved\\Logs\\FortniteGame.log");

let state = {song: "", instrument: "", difficulty: "", stage: ""};
let lastFestivalRelatedEvent = 0;

let follower = follow(logfile);

// watch logfile
follower.on("line", (name, line) => {
    let withoutTimestamp = line.split("]").slice(2).join("]");

    if(withoutTimestamp.toLowerCase().includes("pilgrim")){ 
        lastFestivalRelatedEvent = Date.now();
        // if(withoutTimestamp.startsWith("LogPilgrim")) console.log(line); // for testing purposes
    }

    if(withoutTimestamp.startsWith("LogPilgrimGameEvaluator: UPilgrimGameEvaluator::SetDifficultyAndGetGems")){
        let info = withoutTimestamp.replace("LogPilgrimGameEvaluator: UPilgrimGameEvaluator::SetDifficultyAndGetGems: ", "");
        let difficulty = info.split("EPilgrimSongDifficulty::Difficulty")[1].split(" ")[0]
        let instrument = info.split("EPilgrimTrackType::Track")[1].split(" ")[0]

        console.log("detected " + instrument + " on " + difficulty);

        state.instrument = instrument;
        state.difficulty = difficulty;
        state.stage = "playing";

        updateStatus();
    }

    if(withoutTimestamp === "LogPilgrimGame: UPilgrimGame::StopSong"){
        state.song = "";
        state.stage = "";
        state.instrument = "";
        state.difficulty = "";

        console.log("song stopped")

        updateStatus();
    }

    if(withoutTimestamp.startsWith("LogPilgrimSongPreloader: UPilgrimControllerComponent_SongPreloader::OnFinishedLoadingSong:")){
        let info = withoutTimestamp.replace("LogPilgrimSongPreloader: UPilgrimControllerComponent_SongPreloader::OnFinishedLoadingSong: player ", "");
        let idx = info.lastIndexOf(", song ");
        let player = info.substring(0, idx);
        let song = info.substring(idx + 7);

        state.song = song.toLowerCase();

        console.log("starting song " + song + " as player " + player);

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
                }
            break;
        }

    }
})

const rpc = new RPC.Client({"transport": "ipc"});

function updateStatus(){
    switch(state.stage){
        case "playing":
            rpc.setActivity( {
                "details": tracks[state.song].track.an + " - " + tracks[state.song].track.tt,
                "state": state.instrument + " on " + state.difficulty,
                "largeImageKey": tracks[state.song].track.au,
                "startTimestamp": Date.now()
            });
        break;
        case "pregame":
            rpc.setActivity( {
                "details": "Backstage",
                "state": "Choosing a song...",
                "largeImageKey": "festlogo",
                "startTimestamp": Date.now()
            })
        break;
        case "results":
            rpc.setActivity( {
                "details": "Song Results",
                "state": tracks[state.song].track.tt + ` on ${state.difficulty} ${state.instrument}`,
                "largeImageKey": tracks[state.song].track.au,
                "startTimestamp": Date.now()
            });
        break;
        case "":
            setTimeout( () => {
                if(state.stage === "") rpc.clearActivity();
            }, 5000)
        break;
    }
}

rpc.login({ clientId: "1299298877203157095" })