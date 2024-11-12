import { readFileSync } from "fs";
import { IslandMeta } from "./Modules/Creative";
import { FestivalState } from "./Modules/Festival";
import DiscordRPC from "discord-rpc";
import { version as BetterRPCVersion } from ".";
import { Config } from "./FirstRun";

type SupportedModes = "" | "Creative" | "Festival" | "Lego";
type SkinData = {
    name: string,
    images: {
        icon: string
    }
}

let clientIdMap: {[key: string]: string} = JSON.parse(readFileSync("./clientIds.json").toString());

export default class PresenceManager {
    currentMode: SupportedModes;
    islandMeta: IslandMeta | null;
    festivalState: FestivalState | null;
    skin: SkinData | null;
    rpcClient: DiscordRPC.Client | null;
    timestamp: number;
    localName: string;
    config: Config;

    constructor(config: Config) {
        this.currentMode = "";
        this.skin = null;
        this.islandMeta = null;
        this.rpcClient = null;
        this.timestamp = 0;
        this.festivalState = null;
        this.updateTimestamp();
        this.localName = "";
        this.config = config;
    }

    async setMode(mode: SupportedModes) {
        if(this.rpcClient && mode !== this.currentMode){
            this.rpcClient.destroy();
            this.rpcClient = null;
        }
        if(mode !== "" && mode !== this.currentMode){
            this.rpcClient = new DiscordRPC.Client({"transport": "ipc"});
            await this.rpcClient.login({clientId: clientIdMap[mode]});
        }
        this.currentMode = mode;
        
    }

    setIslandMeta(meta: IslandMeta) {
        this.islandMeta = meta;
    }
    clearIslandMeta(){
        this.islandMeta = null;
    }
    setSkinData(skin: SkinData){
        this.skin = skin;
    }
    async setFestivalState(state: FestivalState){
        if(this.currentMode !== "Festival") await this.setMode("Festival");
        this.festivalState = state;
    }
    updateTimestamp(){
        this.timestamp = Math.floor(Date.now() / 1000);
    }
    async clearStatus(){
        if(this.rpcClient === null) return;
        await this.rpcClient.clearActivity();
    }
    updateStatus(){
        if(this.rpcClient === null || this.rpcClient.user === undefined) return;
        switch(this.currentMode){
            case "Creative":
                this.rpcClient.setActivity({
                    "largeImageKey": this.islandMeta?.square_image_urls !== undefined ? this.islandMeta?.square_image_urls.url_m : this.islandMeta?.image_urls.url_m,
                    "largeImageText": `BetterFortniteRPC by macro (version ${BetterRPCVersion})`,
                    "details": this.islandMeta?.title,
                    "state": `By ${this.islandMeta?.supportCode}`,
                    "smallImageKey": this.skin ? this.skin.images.icon : undefined,
                    "smallImageText": this.skin ? this.skin.name : undefined,
                    "startTimestamp": this.timestamp
                });
            break;
            case "Festival":
                let activity: DiscordRPC.Presence = {
                    "largeImageText": `BetterFortniteRPC by macro (version ${BetterRPCVersion})`,
                    "startTimestamp": this.timestamp,
                    "largeImageKey": "festlogo",
                    "partyId": crypto.randomUUID(),
                    "partySize": (this.festivalState?.players || 0) > 0 ? this.festivalState?.players : 1,
                    "state": this.festivalState?.isBattleStage ? "Battle Stage" : "Main Stage",
                    "partyMax": this.festivalState?.isBattleStage ? 16 : 4
                };

                // kinda messy, but works.
                var instrumentIcon = this.festivalState?.instrument.toLowerCase().split(" ").join("_");
                if(this.festivalState?.song?.track.sib === "Keyboard" && instrumentIcon?.includes("bass")){
                    if(instrumentIcon.startsWith("pro_")) instrumentIcon = "pro_lead_keytar"; else instrumentIcon = "lead_keytar";
                }
                if(this.festivalState?.song?.track.sig === "Keyboard" && instrumentIcon?.includes("lead")){
                    if(instrumentIcon.startsWith("pro_")) instrumentIcon = "pro_lead_keytar"; else instrumentIcon = "lead_keytar";
                }
                if(this.festivalState?.song?.track.siv === "Keyboard" && instrumentIcon?.includes("vocals")) instrumentIcon = "lead_keytar";

                switch(this.festivalState?.stage){
                    case "backstage":
                        activity.details = "Choosing what to play...";
                    break;
                    case "intro":
                        activity.details = "Starting a song...";
                    break;
                    case "playing":
                        activity.details = `${this.festivalState.song?.track.an || "Unknown Artist(s)"} - ${this.festivalState.song?.track.tt || "Unknown Song"}`;
                        activity.largeImageKey = `${this.festivalState.song?.track.au || "festlogo"}`;
                        
                        activity.smallImageKey = `${instrumentIcon}`;
                        activity.smallImageText = this.festivalState.instrument;
                    break;
                    case "results":
                        activity.details = `Results Screen - ${this.festivalState.song?.track.tt || "Unknown Song"}`;
                        activity.largeImageKey = `${this.festivalState.song?.track.au || "festlogo"}`;
                        
                        activity.smallImageKey = `${instrumentIcon}`;
                        activity.smallImageText = this.festivalState.instrument;
                    break;
                }

                 this.rpcClient.setActivity(activity);
            break;
            case "Lego":

            break;
        }
    }
}
