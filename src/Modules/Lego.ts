import LogWatcher from "../LogWatcher";
import PresenceManager from "../Manager";

export function registerLegoHandler(watcher: LogWatcher, manager: PresenceManager){
    watcher.addLineHandler( (line) => {
        if(line.startsWith("LogJunoCoreMutator: [LogJunoCoreMutator::FortGameStateAthena_OnClientPawnLoaded()] [CLIENT]")){
            manager.setMode("Lego");
        }
    })
}