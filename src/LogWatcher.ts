import { watchFile, createReadStream, statSync} from "fs";
import path from "path";

const fortniteLogLocation = path.resolve(process.env.USERPROFILE + "\\AppData\\Local\\FortniteGame\\Saved\\Logs\\FortniteGame.log");

export default class LogWatcher {
    handlers: ((line: string) => void)[];
    lastSize: number;

    constructor(){
        this.handlers = [];
        this.lastSize = statSync(fortniteLogLocation).size;

        watchFile(fortniteLogLocation, {"interval": 250}, (curr, prev) => {
            if(curr.size > prev.size || this.lastSize > curr.size) {
                if(this.lastSize > curr.size) this.lastSize = 0;
                const readStream = createReadStream(fortniteLogLocation, {encoding: "utf-8", start: this.lastSize, end: curr.size});

                readStream.on("data", (chunk) => {
                    const lines = chunk.toString().split("\n");

                    lines.forEach( (line) => {
                        if(line !== "") this.handlers.forEach( (a) => a(line.replace("\r", "")) );
                    });
                });
                this.lastSize = curr.size;
            }
        });
    }
    addLineHandler(handler: (line: string) => void){
        this.handlers.push(handler);
    }
}