import {Decoder} from "../src/lib";
import {Size} from "../src/type";

let dec = new Decoder({
    hello: "string"
});

let buf = new Uint8Array(10);
buf[0] = 0x48;
buf[1] = 0x69;
buf[2] = 0;
buf[3] = 0;
buf[4] = 0;
buf[5] = 0;
buf[6] = 0;
buf[7] = 0;
buf[8] = 100;
buf[9] = 200;
print_o(dec.decode(0n, buf));

function replaceBigInts(obj: any): any {
    if (typeof obj === 'bigint') {
        return Number(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => replaceBigInts(item));
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, replaceBigInts(value)])
        );
    } else {
        return obj;
    }
}

function print_o(obj: any) {
    console.log(JSON.stringify(replaceBigInts(obj), null, 4));
}