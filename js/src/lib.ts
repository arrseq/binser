import {key_size, parse_type, Size, Type, TypeName} from "./type";

export * as ty from "./type";

export enum ResultType {
    Ok, Err
}

export interface OkResult<T> {
    type: ResultType.Ok,
    value: T
}

export interface ErrResult<E> {
    type: ResultType.Err,
    error: E
}

export type Result<T, E> = OkResult<T> | ErrResult<E>;

export function ok<T, E>(value: T): Result<T, E> {
    return { type: ResultType.Ok, value };
}

export function err<T, E>(error: E): Result<T, E> {
    return { type: ResultType.Err, error };
}

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

    private encode_array(array: any[], itemType: Type): Uint8Array | null {
        let bufferArray: Uint8Array[] = [];

        for (let element of array) {
            let encoded = this.encode_type(itemType, element);
            if (encoded == null) return null;
            bufferArray.push(encoded);
        }

        return this.concat_buffers(bufferArray);
    }

    private encode_string(str: string): Uint8Array {
        const encoder = new TextEncoder();
        let encodedString = encoder.encode(str);
        return new Uint8Array([...encodedString, 0x00]);
    }

    public encode_type(ty: Type, value: any): Uint8Array | null {
        switch (ty.type) {
            case TypeName.Bool: {
                return this.encode_bool(value);
            }
            case TypeName.U: {
                return this.encode_u(ty.size, BigInt(value));
            }
            case TypeName.I: {
                return this.encode_i(ty.size, BigInt(value));
            }
            case TypeName.F16: {
                return this.encode_f(value, Size.X16);
            }
            case TypeName.F32: {
                return this.encode_f(value, Size.X32);
            }
            case TypeName.F64: {
                return this.encode_f(value, Size.X64);
            }
            case TypeName.Array: {
                return this.encode_array(value, ty.item_type);
            }
            case TypeName.Vector: {
                let lengthEncoded = this.encode_u(Size.X64, BigInt(value.length));
                let arrayEncoded = this.encode_array(value, ty.item_type);
                if (arrayEncoded == null) return null;
                return this.concat_buffers([lengthEncoded, arrayEncoded]);
            }
            case TypeName.String: {
                return this.encode_string(value);
            }
            case TypeName.Enum: {
                let variantName = Object.keys(value)[0];
                let variantFormat = ty.items[variantName];
                let variantKey = BigInt(Object.keys(ty.items).indexOf(variantName));
                let keyEncoded = this.encode_u(key_size(ty.items), variantKey);

                let fieldBuffers: Uint8Array[] = [];
                for (let [fieldName, fieldType] of Object.entries(variantFormat)) {
                    let fieldValue = value[variantName][fieldName];
                    let fieldEncoded = this.encode_type(fieldType, fieldValue);
                    if (fieldEncoded == null) return null;
                    fieldBuffers.push(fieldEncoded);
                }

                return this.concat_buffers([keyEncoded, ...fieldBuffers]);
            }
            default: {
                console.log("Unsupported for encoding");
                return null;
            }
        }
    }

    public encode(value: T): Uint8Array | null {
        let bufferArray: Uint8Array[] = [];
        let keys = Object.keys(this.types);
        let vals = Object.values(this.types);

        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let ty = vals[i];
            let fieldValue = (value as any)[key];

            let encodedField = this.encode_type(ty, fieldValue);
            if (encodedField == null) return null;

            bufferArray.push(encodedField);
        }

        return this.concat_buffers(bufferArray);
    }

    private encode_bool(value: boolean): Uint8Array {
        return new Uint8Array([value ? 1 : 0]);
    }

    private encode_u(size: Size, value: bigint): Uint8Array | null {
        return this.encode_int_bytes(size, value, false);
    }

    private encode_i(size: Size, value: bigint): Uint8Array | null {
        return this.encode_int_bytes(size, value, true);
    }

    private encode_f(value: number, size: Size): Uint8Array | null {
        let buffer = new ArrayBuffer(size === Size.X16 ? 2 : size === Size.X32 ? 4 : 8);
        let view = new DataView(buffer);

        if (size === Size.X16) {
            this.write_f16(view, 0, value);
        } else if (size === Size.X32) {
            view.setFloat32(0, value, true);
        } else if (size === Size.X64) {
            view.setFloat64(0, value, true);
        }

        return new Uint8Array(buffer);
    }

    private encode_int_bytes(size: Size, value: bigint, signed: boolean): Uint8Array | null {
        let buffer = new ArrayBuffer(size === Size.X8 ? 1 : size === Size.X16 ? 2 : size === Size.X32 ? 4 : 8);
        let view = new DataView(buffer);

        if (signed) {
            switch (size) {
                case Size.X8:
                    view.setInt8(0, Number(value));
                    break;
                case Size.X16:
                    view.setInt16(0, Number(value), true);
                    break;
                case Size.X32:
                    view.setInt32(0, Number(value), true);
                    break;
                case Size.X64:
                    view.setBigInt64(0, value, true);
                    break;
            }
        } else {
            switch (size) {
                case Size.X8:
                    view.setUint8(0, Number(value));
                    break;
                case Size.X16:
                    view.setUint16(0, Number(value), true);
                    break;
                case Size.X32:
                    view.setUint32(0, Number(value), true);
                    break;
                case Size.X64:
                    view.setBigUint64(0, value, true);
                    break;
            }
        }

        return new Uint8Array(buffer);
    }

    private concat_buffers(buffers: Uint8Array[]): Uint8Array {
        let totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);
        let result = new Uint8Array(totalLength);

        let offset = 0;
        buffers.forEach(buffer => {
            result.set(buffer, offset);
            offset += buffer.length;
        });

        return result;
    }

    private write_f16(view: DataView, byteOffset: number, value: number): void {
        let floatView = new DataView(new ArrayBuffer(4));
        floatView.setFloat32(0, value, true);

        const bits = floatView.getUint32(0);
        const sign = (bits >> 16) & 0x8000;
        const exp = (bits >> 23) & 0xff;
        const fraction = bits & 0x7fffff;

        let h;
        if (exp === 0) {
            h = (sign | (fraction >> 13));
        } else if (exp === 0xff) {
            h = (sign | 0x7c00 | (fraction ? 1 : 0));
        } else {
            h = (sign | ((exp - 112) << 10) | (fraction >> 13));
        }

        view.setUint16(byteOffset, h, true);
    }
}