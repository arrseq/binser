import {Decoder} from "../src/lib";
import {parse_ktp, parse_object, parse_type, Size} from "../src/type";

interface Struct {
    enum: {
        VariantA?: { c: boolean, h: [number] },
        VariantB?: {}
    }
}

let dec = new Decoder<Struct>({
    enum: "enum VariantA[c: bool, h: [u8; 1]], VariantB[]"
});

let buf = new Uint8Array(3);
buf[0] = 0;
buf[1] = 0;
buf[2] = 0;
print_o(dec.decode(0n, buf)[0].enum.VariantA);

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