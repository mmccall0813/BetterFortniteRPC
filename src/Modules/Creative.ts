import LogWatcher from "../LogWatcher";
import PresenceManager from "../Manager";
import axios from "axios";

export interface IslandMeta {
    title: string,
    supportCode: string,
    square_image_urls: {
        url_s: string,
        url_m: string,
        url: string
    },
    image_urls: {
        url_s: string,
        url_m: string,
        url: string
    }
}

export function registerCreativeHandler(watcher: LogWatcher, manager: PresenceManager){
    let islandCode = "";

    watcher.addLineHandler( async (line) => {
        let withoutTimestamp = line.split("]").slice(2).join("]");

        let islandCodeFinder = "LogFortLoadingScreen: [FLoadingScreenParams::UpdateZoneConfigFromActivity] - Setting Zone Config for Activity ";
        if(withoutTimestamp.startsWith(islandCodeFinder)){
            islandCode = withoutTimestamp.replace(islandCodeFinder, "").split("?")[0];

            console.log("Now in Creative with island code " + islandCode);
            await manager.setMode("Creative");

            
            try {
                const islandInfo = await axios.get(`http://festrpc.highwi.re:8924/island-code?code=${islandCode}`); // would use the epic api directly, but it requires auth...

                manager.setIslandMeta(islandInfo.data.metadata);

                manager.updateTimestamp();
                manager.updateStatus();
            } catch (err){
                console.log("couldnt fetch island info...");
                console.log(err);
            }
            
        }
    })
}