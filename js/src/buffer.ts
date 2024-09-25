import {Float16Array} from "@petamoriken/float16";

export type BufferType = Uint8ClampedArray
    | Uint16Array
    | Uint32Array
    | BigUint64Array
    | Int8Array
    | Int16Array
    | Int32Array
    | BigInt64Array
    | Float16Array
    | Float32Array
    | Float64Array;