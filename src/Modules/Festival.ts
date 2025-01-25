import LogWatcher from "../LogWatcher";
import PresenceManager from "../Manager";
import axios from "axios";

export type Song = {
    _title: string;
    track: Track;
    _noIndex: boolean;
    _activeDate: string; 
    lastModified: string; 
    _locale: string;
    _templateName: string; 
  };
  
  type Track = {
    tt: string; // title
    ry: number;  // year
    dn: number;  // song length in seconds
    sib: string; // bass icon
    sid: string; // drums icon
    sig: string;  // guitar icon
    qi: string; // ?
    sn: string;  // id
    ge: string[]; // genres, sometimes undefined?
    mk: string;  // key
    mm: string;  // key type
    ab: string;  // album, sometimes blank
    siv: string; // vocals icon
    su: string; // uuid?
    in: Intensities;
    mt: number; // tempo (?)
    _type: string;
    mu: string; 
    an: string;  // artist
    gt: string[]; 
    ar: string; 
    au: string; 
    ti: string; 
    ld: string;
    jc: string;
  };
  
  type Intensities = {
    pb: number;
    pd: number;
    vl: number; 
    pg: number; 
    _type: string; 
    gr: number; 
    ds: number; 
    ba: number; 
  };

let tracks: {[key: string]: Song} = {};

axios.get("https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks").then(data => {
    Object.values(data.data).forEach( (track) => {
        if(typeof track === "object" && !Array.isArray(track)){
            let song = track as Song;
            tracks[song.track.sn.toLowerCase()] = song;
        }
    })
})

export type FestivalState = {
    song: Song | null,
    instrument: string, 
    difficulty: string, 
    stage: "" | "playing" | "backstage" | "results" | "intro",
    players: number,
    isBattleStage: boolean
};

export async function registerFestivalHandler(watcher: LogWatcher, manager: PresenceManager){
    let festState: FestivalState = {song: null, instrument: "", difficulty: "", stage: "", players: 0, isBattleStage: false};
    // i hate typescript so much
    const connectionsManager = new ((await import("./FestivalConnections.mjs")).default)(manager.config);

    watcher.addLineHandler( async (line) => {
        let withoutTimestamp = line.split("]").slice(2).join("]");
        // im using extra spacing between the conditionals here to its easier for my ape brain to see where they start and end


        let difficultyFinder = /LogPilgrimGameEvaluator: \[....\] : Song data set. [0-9]* gems found for /g;
        if(difficultyFinder.test(withoutTimestamp)){
            let info = withoutTimestamp.replace(difficultyFinder, "");
            let difficulty = info.split("EPilgrimSongDifficulty::Difficulty")[1].split(" ")[0];
            let instrument = info.split("EPilgrimTrackType::Track")[1].split(" ")[0].replace("Plastic", "Pro ").replace("Drum", "Drums").replace("Guitar", "Lead");

            festState.instrument = instrument;
            festState.difficulty = difficulty;
            festState.stage = "playing";

            if(festState.song) connectionsManager.startSong(festState.song, instrument, difficulty);

            // console.log("PLAYING " + instrument + " " + difficulty);

            manager.updateTimestamp();
            await manager.setFestivalState(festState);
            manager.updateStatus();
        }



        let songIdFinder = /Client [-]?[0-9] received song to play: /g;
        if(songIdFinder.test(withoutTimestamp)){
            let song = withoutTimestamp.split(songIdFinder)[1].split(" ")[0];
            song = song.toLowerCase();

            // console.log("starting song " + song);

            if(tracks[song] !== undefined){
                festState.song = tracks[song];
            } else {
                console.log(`couldnt find song ${song} in sparktracks...`)
            }
        }



        if(withoutTimestamp.startsWith("LogPilgrimQuickplayStateMachine")){
            let leaving = withoutTimestamp.includes("Leaving ");
            let state = withoutTimestamp.split("Pilgrim Quickplay state ")[1];

            // console.log(`fest state change: ${leaving ? "leaving " : ""}"${state}"`);

            switch(state){
                case "EPilgrimQuickplayState::Pregame":
                    if(leaving){
                        festState.stage = "";
                    } else {
                        festState.stage = "backstage";
                    }

                    manager.updateTimestamp();
                    await manager.setFestivalState(festState);
                    manager.updateStatus();
                break;
                case "EPilgrimQuickplayState::SongResults":
                    if(leaving){
                        festState.stage = "";
                    } else {
                        festState.stage = "results";
                        manager.updateTimestamp();
                    }
                    await manager.setFestivalState(festState);
                    manager.updateStatus();
                break;
                case "EPilgrimQuickplayState::Preintro":
                case "EPilgrimQuickplayState::Intro":
                    if(!leaving){
                        festState.stage = "intro";
                        await manager.setFestivalState(festState);
                        manager.updateStatus();
                    }
                break;
            }
        }



        if(withoutTimestamp.includes("BP_BattleStage_Platform_C_UAID")){
            festState.isBattleStage = true;
        }



        if(withoutTimestamp.includes("UPilgrimFTUEControllerComponent::EndPlay") || /LogPilgrimGame: \[....\] Stopping song/g.test(withoutTimestamp)){
            festState.stage = "";
            connectionsManager.stopSong();

            
            if(withoutTimestamp.includes("EndPlay")){
                // manager.setMode("");
                festState.isBattleStage = false;
                festState.players = -1;
            } else {
                await manager.setFestivalState(festState);
                manager.updateStatus();
            }
        }



        if(withoutTimestamp.startsWith("LogPilgrimQuickplayBandState: Display: PlayerAdded: ")){
            festState.players++;
        }



        if(withoutTimestamp.startsWith("LogPilgrimQuickplayBandState: Display: PlayerRemoved:")){
            festState.players--;
            await manager.setFestivalState(festState);
            manager.updateStatus();
        }
    })
}