// Type definitions for youtube-dl 1.12
// Project: https://www.npmjs.com/package/youtube-dl
// Definitions by: Bogdan Surai <https://github.com/bsurai>
//                 David Pasztor <https://github.com/davidpasztor> 
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.4

/// <reference types="node" />
import * as fs from "fs";

export = youtubedl;
declare function youtubedl(url: string, arg?: string[], opt?: {[key: string]: string}): youtubedl.Youtubedl;
declare namespace youtubedl {
    interface Youtubedl {
        on(event: string, func: (info: Info) => void): this;
        pipe(stream: fs.WriteStream): this;
    }
    interface Info {
        _filename: string;
        filename: string;
        size: number;
        title: string;
        id: string;
        categories: string[];
        duration: number;
    }
    function getThumbs(url:string, options: object, callback: (error:Error,thumbs:string[])=>void):void;
}
