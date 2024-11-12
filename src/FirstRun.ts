import * as fs from "fs";
import promptsync from "prompt-sync";
import axios from "axios";
import crypto from "crypto";


const prompt = promptsync();

export interface Config {
    lastfm: {
        scrobbling: boolean,
        api_key: string,
        api_secret: string,
        session_key: string
    },
    analytics: {
        enable: boolean,
        identifier: string
    }
}

export function firstRun(){
    console.log("It looks like this is your first time running BetterFortniteRPC!", "Lets get a configuration made for you real quick...");
    let config: Config = {
        lastfm: {
            scrobbling: false,
            api_key: "",
            api_secret: "",
            session_key: ""
        },
        analytics: {
            enable: false,
            identifier: "anonymous"
        }
    }
    let saved = false;

    let setupScrobble = "";

    while(setupScrobble[0] !== "y" && setupScrobble !== "n"){
        setupScrobble = prompt("Would you like to setup Last.fm scrobbling for Festival? (y/n) ");
    };

    let lastfm = {
        api_key: "",
        api_secret: "",
        username: "",
        password: "",
        session_key: ""
    }
    if(setupScrobble[0] === "y"){
        lastfm.api_key = prompt("LastFM API Key: ");
        lastfm.api_secret = prompt("LastFM API Secret: ");
        console.log("Your username and password are not stored, and are used only once to generate a session key for API requests.");
        lastfm.username = prompt("LastFM Username: ");
        lastfm.password = prompt("LastFM Password: ");

        console.log("Assuming the above info is correct, any song you play on Festival with BetterFortniteRPC running will be scrobbled to your LastFM account.");
        console.log("If the program crashes after you finish this setup, your Last.FM details were likely incorrect.\n");

        (async () => {
            const lastfm_ts_api = await import('lastfm-ts-api');
            const LastFMAuth = lastfm_ts_api.LastFMAuth;

            let auth = new LastFMAuth(lastfm.api_key, lastfm.api_secret);
        
            auth.getMobileSession({"username": lastfm.username, "password": lastfm.password}).then( (res) => {
                config.lastfm = {
                    scrobbling: true,
                    api_key: lastfm.api_key,
                    api_secret: lastfm.api_secret,
                    session_key: res.session.key
                };
                if(saved) fs.writeFileSync("config.json", JSON.stringify(config, null, 4));
            });
        })();
        
    }

    console.log("Would you like to opt in to analytics?");
    console.log("The data collected includes: what song you are currently playing, your selected instrument and difficulty, and how long you've spent playing specific songs");
    console.log("This data is used to see whats popular among festival players, and is accesible via a Discord bot (https://discord.gg/5TvH3pjeud)");
    console.log("The collected data is associated to an identifier (which is by default \"anonymous\"), and cannot be traced back to you unless you change said identifier");

    let analyticsConsent = "";

    while(analyticsConsent[0] !== "y" && analyticsConsent[0] !== "n"){
        analyticsConsent = prompt("(y/n) ");
    }

    if(analyticsConsent[0] === "y"){
        config.analytics.enable = true;
        let identifier = prompt("Please enter your preferred identifier, or hit enter to set it to anonymous:");
        config.analytics.identifier = (identifier === "" ? "anonymous" : identifier);
        console.log("Thank you! If you ever want to opt out, set \"enable\" to false in config.json");
    }

    fs.writeFileSync("config.json", JSON.stringify(config, null, 4));
    saved = true;
}