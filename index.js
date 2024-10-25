const fs = require("fs");
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

// watch logfile
let logfile = path.resolve(process.env.USERPROFILE + "\\AppData\\Local\\FortniteGame\\Saved\\Logs\\FortniteGame.log");

let state = {song: "", instrument: "", difficulty: "", stage: ""};
let lastFestivalRelatedEvent = 0;

let follower = follow(logfile);

follower.on("line", (name, line) => {
    let withoutTimestamp = line.split("]").slice(2).join("]");

    if(withoutTimestamp.toLowerCase().includes("pilgrim")){ 
        lastFestivalRelatedEvent = Date.now();
        // console.log(line); // for testing purposes
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

})

const rpc = new RPC.Client({"transport": "ipc"});

function updateStatus(){
    if(state.stage === "playing"){
        rpc.setActivity( {
            "details": tracks[state.song].track.an + " - " + tracks[state.song].track.tt,
            "state": state.instrument + " on " + state.difficulty,
            "largeImageKey": tracks[state.song].track.au,
            "startTimestamp": Date.now()
        });
    }
    if(state.stage === ""){
        rpc.clearActivity();
    }
}

rpc.login({ clientId: "1299298877203157095" })