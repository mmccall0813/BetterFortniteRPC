import io, { Socket } from 'socket.io-client';
import { Config } from '../FirstRun.js';
import { LastFMTrack, LastFMTrackUpdateNowPlayingParams } from 'lastfm-ts-api';
import { Song } from './Festival.js';

export default class FestivalConnectionsManager {
    config: Config;
    socket: Socket | null;
    trackStart: number;
    minSeconds: number;
    nowPlaying: LastFMTrackUpdateNowPlayingParams | undefined;
    track: LastFMTrack | null;

    constructor(config: Config) {
        this.config = config;
        this.socket = this.config.analytics.enable ? io('ws://festrpc.highwi.re:8924') : null;
        this.track = this.config.lastfm.scrobbling ? new LastFMTrack(config.lastfm.api_key, config.lastfm.api_secret, config.lastfm.session_key) : null;
        this.trackStart = 0;
        this.minSeconds = 0;

        this.socket?.on("connect", () => {
            this.socket?.emit("identify", this.config.analytics.identifier);
        });

        this.socket?.on("error", (error) => {
            console.error("Socket error:", error);
        });
    }

    startSong(song: Song, instrument: string, difficulty: string) {
        this.trackStart = Date.now();
        if (this.config.lastfm.scrobbling && this.track) {
            this.minSeconds = song.track.dn / 2;
            this.nowPlaying = {
                track: song.track.tt,
                artist: song.track.an,
                album: song.track.ab || undefined,
                duration: song.track.dn
            };
            this.track.updateNowPlaying(this.nowPlaying).catch(error => {
                console.error("Error updating now playing:", error);
            });
        }
        if (this.config.analytics.enable && this.socket) {
            this.socket.emit("startSong", song.track.sn, instrument, difficulty);
        }
    }

    stopSong() {
        if (this.trackStart === 0) return; // program was probably started before the song ended

        if (this.config.analytics.enable && this.socket) {
            this.socket.emit("stopSong");
        }

        if (this.config.lastfm.scrobbling && this.track && this.nowPlaying) {
            if ((Math.floor((Date.now() - this.trackStart) / 1000) >= this.minSeconds)) {
                this.track.scrobble({ "timestamp": (Math.floor(this.trackStart / 1000)), ...this.nowPlaying }).catch(error => {
                    console.error("Error scrobbling track:", error);
                });
                this.nowPlaying = undefined;
                this.trackStart = 0;
            }
        }
    }
}
