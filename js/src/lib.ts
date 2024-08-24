import {key_size, parse_type, Size, Type, TypeName} from "./type";

export * as ty from "./type";

export class Decoder<T> {
    public types: { [index: string]: Type } = {};

    constructor(types: { [index: string]: string }) {
        let k = Object.keys(types);
        Object.values(types).forEach((t, i) => {
            let res = parse_type(t);
            if (res == null) { throw new Error(`Failed to parse type for ${k[i]}`); }

            this.types[k[i]] = res.value;
        });
    }

    private read_array(length: bigint, itemType: Type, pos: bigint, buffer: Uint8Array): [any[], bigint] | null {
        let arrayResult = [];
        let initialPos = pos;

        for (let i = 0n; i < length; i++) {
            let element = this.decode_type(itemType, pos, buffer);
            if (element == null) {
                console.log(`Cannot decode array element at index ${i}`);
                return null;
            }
            arrayResult.push(element[0]);
            pos += element[1];
        }

        return [arrayResult, pos - initialPos];
    }

    private read_string(pos: bigint, buffer: Uint8Array): [string, bigint] | null {
        const start = Number(pos);
        const decoder = new TextDecoder('utf-8');

        let end = start;
        while (end < buffer.length && buffer[end] !== 0x00) {
            end++;
        }

        const value = decoder.decode(buffer.slice(start, end));
        return [value, BigInt(end - start)];
    }

    public decode_type(ty: Type, pos: bigint, buffer: Uint8Array): [any, bigint] | null {
        let res: any = null;
        let s_pos = pos;

        switch (ty.type) {
            case TypeName.Bool: {
                let bool = this.read_bool(pos, buffer);
                if (bool == null) {
                    console.log("Cannot parse boolean");
                    return null;
                }
                res = bool[0] >= 1;
                pos += bool[1];
                break;
            }
            case TypeName.U: {
                let size = ty.size;
                let uValue = this.read_u(size, pos, buffer);
                if (uValue == null) {
                    console.log("Cannot parse unsigned integer");
                    return null;
                }
                res = uValue[0];
                pos += uValue[1];
                break;
            }
            case TypeName.I: {
                let size = ty.size;
                let uValue = this.read_i(size, pos, buffer);
                if (uValue == null) {
                    console.log("Cannot parse unsigned integer");
                    return null;
                }
                res = uValue[0];
                pos += uValue[1];
                break;
            }
            case TypeName.F16: {
                const f16Value = this.read_f(pos, buffer, Size.X16);
                if (f16Value == null) {
                    console.log("Cannot parse float16");
                    return null;
                }
                res = f16Value[0];
                pos += f16Value[1];
                break;
            }
            case TypeName.F32: {
                const f32Value = this.read_f(pos, buffer, Size.X32);
                if (f32Value == null) {
                    console.log("Cannot parse float32");
                    return null;
                }
                res = f32Value[0];
                pos += f32Value[1];
                break;
            }
            case TypeName.F64: {
                const f64Value = this.read_f(pos, buffer, Size.X64);
                if (f64Value == null) {
                    console.log("Cannot parse float64");
                    return null;
                }
                res = f64Value[0];
                pos += f64Value[1];
                break;
            }
            case TypeName.Array: {
                let arrayResult = this.read_array(ty.length, ty.item_type, pos, buffer);
                if (arrayResult == null) {
                    console.log("Cannot decode array");
                    return null;
                }
                res = arrayResult[0];
                pos += arrayResult[1];
                break;
            }
            case TypeName.Vector: {
                let lengthResult = this.read_u(Size.X64, pos, buffer);
                if (lengthResult == null) {
                    console.log("Cannot decode vector length");
                    return null;
                }
                pos += lengthResult[1];
                let arrayResult = this.read_array(lengthResult[0], ty.item_type, pos, buffer);
                if (arrayResult == null) {
                    console.log("Cannot decode vector");
                    return null;
                }
                res = arrayResult[0];
                pos += arrayResult[1];
                break;
            }
            case TypeName.String: {
                let stringResult = this.read_string(pos, buffer);
                if (stringResult == null) {
                    console.log("Cannot decode string");
                    return null;
                }
                res = stringResult[0];
                pos += stringResult[1];
                break;
            }
            case TypeName.Enum: {
                let key = this.read_u(key_size(ty.items), pos, buffer);
                if (key == null) { console.log("Cannot read enum key"); return null; }
                pos += key[1];

                let variant_key = key[0];
                let variant_name = Object.keys(ty.items)[Number(variant_key)];
                let variant_format = Object.values(ty.items)[Number(variant_key)];
                let obj_out: any = {};

                let fields = Object.values(variant_format);
                let names = Object.keys(variant_format);

                fields.forEach((field, index) => {
                    let decoded = this.decode_type(field,  pos, buffer);
                    if (decoded == null) { console.log("Invalid field, could not decode", names[index]); return null; }
                    pos += decoded[1];

                    obj_out[names[index]] = decoded[0];
                });

                let enum_body: any = {};
                enum_body[variant_name] = obj_out;

                res = enum_body;
                break;
            }
            default: {
                console.log("Unsupported for parsing");
                return null;
            }
        }

        return [res, pos - s_pos];
    }

    public decode(pos: bigint, buffer: Uint8Array): [T, bigint] | null {
        let keys = Object.keys(this.types);
        let vals = Object.values(this.types);
        let res: any = {};
        let s_pos = pos;

        vals.forEach((ty, index) => {
            let key = keys[index];
            let ret = this.decode_type(ty, pos, buffer);
            if (ret == null) { return null; }

            res[key] = ret[0];
            pos += ret[1];
        });

        return [res as T, pos - s_pos];
    }

    private read_f16(bytePos: number, buffer: Uint8Array): number {
        const h = new DataView(buffer.buffer, buffer.byteOffset + bytePos, 2).getUint16(0, true);
        const sign = (h & 0x8000) >> 15;
        const exponent = (h & 0x7C00) >> 10;
        const fraction = h & 0x03FF;

        if (exponent === 0) return sign ? -0 : 0;

        if (exponent === 0x1F) return fraction ? NaN : (sign ? -Infinity : Infinity);

        const e = exponent - 15;
        const f = fraction / 1024.0;
        return (sign ? -1 : 1) * (1 + f) * Math.pow(2, e);
    }

    public read_f64(pos: bigint, buffer: Uint8Array): [number, bigint] | null {
        const bytePos = Number(pos);
        if (bytePos + 8 > buffer.length) {
            return null;
        }

        const dataView = new DataView(buffer.buffer, buffer.byteOffset + bytePos, 8);
        const value = dataView.getFloat64(0, true);
        return [value, 8n];
    }

    public read_f(pos: bigint, buffer: Uint8Array, size: Size): [number, bigint] | null {
        const bytePos = Number(pos);
        if (size === Size.X16 && bytePos + 2 <= buffer.length) {
            const value = this.read_f16(bytePos, buffer);
            return [value, 2n];
        } else if (size === Size.X32 && bytePos + 4 <= buffer.length) {
            const dataView = new DataView(buffer.buffer, buffer.byteOffset + bytePos, 4);
            const value = dataView.getFloat32(0, true);
            return [value, 4n];
        } else if (size === Size.X64 && bytePos + 8 <= buffer.length) {
            const value = this.read_f64(pos, buffer);
            return [value[0], value[1]];
        } else {
            return null;
        }
    }

    public read_bool(pos: bigint, buffer: Uint8Array): [bigint, bigint] | null {
        const bytePos = Number(pos);
        if (bytePos < 0 || bytePos >= buffer.length) {
            return null;
        }

        const value = buffer[bytePos] !== 0 ? 1n : 0n;
        const len = 1n;

        return [value, len];
    }

    private read_int_bytes(size: Size, pos: bigint, buffer: Uint8Array, signed: boolean): [bigint, bigint] | null {
        const bytePos = Number(pos);
        let result = BigInt(0);
        let len = BigInt(0);

        switch (size) {
            case Size.X8:
                result = BigInt(buffer[bytePos]);
                len = 1n;
                break;
            case Size.X16:
                result = BigInt(buffer[bytePos]) |
                    (BigInt(buffer[bytePos + 1]) << 8n);
                len = 2n;
                break;
            case Size.X32:
                result = BigInt(buffer[bytePos]) |
                    (BigInt(buffer[bytePos + 1]) << 8n) |
                    (BigInt(buffer[bytePos + 2]) << 16n) |
                    (BigInt(buffer[bytePos + 3]) << 24n);
                len = 4n;
                break;
            case Size.X64:
                result = BigInt(buffer[bytePos]) |
                    (BigInt(buffer[bytePos + 1]) << 8n) |
                    (BigInt(buffer[bytePos + 2]) << 16n) |
                    (BigInt(buffer[bytePos + 3]) << 24n) |
                    (BigInt(buffer[bytePos + 4]) << 32n) |
                    (BigInt(buffer[bytePos + 5]) << 40n) |
                    (BigInt(buffer[bytePos + 6]) << 48n) |
                    (BigInt(buffer[bytePos + 7]) << 56n);
                len = 8n;
                break;
            default:
                return null;
        }

        if (signed) {
            const mask = {
                [Size.X8]: 0x80n,
                [Size.X16]: 0x8000n,
                [Size.X32]: 0x80000000n,
                [Size.X64]: 0x8000000000000000n,
            }[size];

            if (result & mask) {
                result -= (mask << 1n);
            }
        }

        return [result, len];
    }

    public read_u(size: Size, pos: bigint, buffer: Uint8Array): [bigint, bigint] | null {
        return this.read_int_bytes(size, pos, buffer, false);
    }

    public read_i(size: Size, pos: bigint, buffer: Uint8Array): [bigint, bigint] | null {
        return this.read_int_bytes(size, pos, buffer, true);
    }
}