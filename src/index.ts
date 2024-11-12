import { appendFileSync } from "fs";
import LogWatcher from "./LogWatcher";
import PresenceManager from "./Manager";
import {registerCreativeHandler} from "./Modules/Creative";
import axios from "axios";
import { registerFestivalHandler } from "./Modules/Festival";
import * as fs from "fs";
import { firstRun, Config } from "./FirstRun";
import { registerLegoHandler } from "./Modules/Lego";

export let version = "v1.0.0";

if(!fs.existsSync("config.json")) firstRun();
const config: Config = JSON.parse(fs.readFileSync("config.json").toString());

const watcher = new LogWatcher();
const manager = new PresenceManager(config);

registerCreativeHandler(watcher, manager);
registerFestivalHandler(watcher, manager);
registerLegoHandler(watcher, manager);

watcher.addLineHandler( async (line) => {
    // appendFileSync("log.txt", line + "\n"); // for debugging

    if(line.startsWith("--- [Character]=AthenaCharacter:")){
        let skin = line.replace("--- [Character]=AthenaCharacter:", "");
        
        // console.log("detected skin " + skin);

        try {
            let skinData = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/${skin}`);

            manager.setSkinData(skinData.data.data);
            manager.updateStatus();
        } catch(err){
            console.log("Couldn't fetch skin info... (this is normal for Lego and Fall Guys modes)");
        }
    }

    if(line.includes("LogOnlineGame: FortPC::ClientReturnToMainMenuWithTextReason()")){
        console.log("Clearing status (left game)");
        await manager.clearStatus();
        manager.clearIslandMeta();
        
        await manager.setMode("");
    }

    let localNameFinder = "LogFort: UFortRegisteredPlayerInfo is requesting a refresh for ";
    if(line.includes(localNameFinder)){
        let localName = line.split(localNameFinder)[1];
        manager.localName = localName;
    }
    // if(line.includes("LogPilgrim")) console.log(line);
});

console.log("Started!");