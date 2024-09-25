export enum Size {X8, X16, X32, X64}

export function key_size(obj: { [key: string]: any }): Size {
    const keyCount = Object.keys(obj).length;

    if (keyCount <= 0xFF) {
        return Size.X8;
    } else if (keyCount <= 0xFFFF) {
        return Size.X16;
    } else if (keyCount <= 0xFFFFFFFF) {
        return Size.X32;
    } else {
        return Size.X64;
    }
}

export enum TypeName {
    Bool,

    U,
    I,
    F16,
    F32,
    F64,

    String,
    Enum,

    Array,
    Vector
}

export type Variants = { [index: string]: KtpM };

export interface BoolType { type: TypeName.Bool }
export interface UintType { type: TypeName.U, size: Size }
export interface IntType { type: TypeName.I, size: Size }
export interface FType {
    type: TypeName.F16
        | TypeName.F32
        | TypeName.F64
}
export interface StringType { type: TypeName.String }
export interface Enum {
    type: TypeName.Enum,
    items: Variants
}
export interface ArrayType {
    type: TypeName.Array,
    item_type: Type,
    length: bigint,
    buffered: boolean
}
export interface VectorType {
    type: TypeName.Vector,
    item_type: Type,
    buffered: boolean
}

export type Type = BoolType
    | UintType
    | IntType
    | FType
    | StringType
    | Enum
    | ArrayType
    | VectorType;
export type Ktp = [string, Type];
export type KtpM = { [index: string]: Type };

export function new_type(type: Type): Type { return type; }

export interface ParseResult<T> {
    value: T,
    length: number
}

export function new_result<T>(res: ParseResult<T>): ParseResult<T> { return res; }

export function parse_size(tstr: string): ParseResult<Size> | null {
    if (tstr.startsWith("8")) { return { value: Size.X8, length: 1 }; }
    if (tstr.startsWith("16")) { return { value: Size.X16, length: 2 }; }
    if (tstr.startsWith("32")) { return { value: Size.X32, length: 2 }; }
    if (tstr.startsWith("64")) { return { value: Size.X64, length: 2 }; }
    return null;
}

export function parse_buffered(tstr: string): ParseResult<void> | null {
    if (!tstr.startsWith("x:")) {
        return null;
    }

    return new_result({
        value: null,
        length: 2
    });
}


export function parse_ident(tstr: string): ParseResult<string> | null {
    const regex = /^[a-zA-Z0-9_]+/;
    const match = tstr.match(regex);

    if (!match) {
        return null;
    }

    const value = match[0];
    const length = value.length;

    return { value, length };
}

export function parse_ktp(tstr: string): ParseResult<Ktp> | null {
    let len = 0;
    let ident = parse_ident(tstr);
    if (ident == null) { console.log("Cannot parse object ident"); return null; }
    tstr = tstr.substring(ident.length);
    len += ident.length;

    let cs = ": ";
    if (tstr.startsWith(cs)) {
        tstr = tstr.substring(cs.length);
        len += cs.length;

        let ty = parse_type(tstr);
        if (ty == null) { console.log("Cannot parse KTP's type"); return null; }
        len += ty.length;

        return new_result({
            value: [ident.value, ty.value],
            length: len
        });
    }

    return null;
}

export function parse_object(o: string): ParseResult<[string, KtpM]> | null {
    let l = 0;

    // read variant name.
    let variant = parse_ident(o);
    if (variant == null) { console.log("Invalid variant name", o); return null; }
    l += variant.length;
    o = o.substring(variant.length);

    // skip opening bracket.
    o = o.substring(1);
    l += 1;

    let type_out: KtpM = {};

    while (true) {
        if (o.startsWith("]")) {
            l += 1;
            break;
        }

        let ktp = parse_ktp(o);
        if (ktp == null) { console.log("Invalid ktp"); return null; }
        l += ktp.length;

        type_out[ktp.value[0]] = ktp.value[1];
        o = o.substring(ktp.length);

        if (o.startsWith(", ")) {
            o = o.substring(2);
            l += 2;
        }
    }

    return new_result({
        value: [variant.value, type_out],
        length: l
    });
}

export function parse_num(tstr: string): ParseResult<bigint> | null {
    let index = 0;
    while (index < tstr.length && /\d/.test(tstr[index])) {
        index++;
    }

    if (index === 0) {
        return null;
    }

    const num = BigInt(tstr.slice(0, index));
    return { value: num, length: index };
}

function can_buffer(type: TypeName): boolean {
    let can = false;
    switch (type) {
        case TypeName.Enum:
        case TypeName.Array:
        case TypeName.Vector:
        case TypeName.String:
        case TypeName.Bool:
            break;
        case TypeName.U:
        case TypeName.I:
        case TypeName.F16:
        case TypeName.F32:
        case TypeName.F64:
            can = true;
            break;
    }
    return can;
}

export function parse_type(tstr: string): ParseResult<Type> | null {
    let len = 0;
    if (tstr.startsWith("bool")) { return new_result({
        value: new_type({ type: TypeName.Bool }),
        length: 4
    }); }
    if (tstr.startsWith("u") || tstr.startsWith("i")) {
        let ui = tstr.startsWith("u") ? TypeName.U : TypeName.I;
        tstr = tstr.substring(1);
        len += 1;

        let size = parse_size(tstr);
        if (size == null) { return null; }
        len += size.length;

        return new_result({
            value: new_type({type: ui, size: size.value}),
            length: len
        });
    }
    if (tstr.startsWith("f")) {
        tstr = tstr.substring(1);
        len += 1;

        let size = parse_size(tstr);
        if (size == null || size.value == Size.X8) { return null; }
        len += size.length;

        let type: TypeName;
        switch (size.value) {
            case Size.X16:
                type = TypeName.F16;
                break;
            case Size.X32:
                type = TypeName.F32;
                break;
            case Size.X64:
                type = TypeName.F64;
                break;
        }

        return new_result({
            value: new_type({ type }),
            length: len
        });
    }

    let enum_word = "enum ";
    let cs = ", ";
    let ss = "; ";
    let string = "string";

    if (tstr.startsWith(enum_word)) {
        tstr = tstr.substring(enum_word.length);
        len += enum_word.length;

        let tys: Variants = {};

        while (true) {
            let obj = parse_object(tstr);
            if (obj == null) { return null; }
            tstr = tstr.substring(obj.length);
            len += obj.length;

            let x_keyname = obj.value[0];
            tys[x_keyname] = obj.value[1];

            // check for ", " to indicate next
            if (tstr.startsWith(cs)) {
                tstr = tstr.substring(cs.length);
                len += cs.length;
            } else { break; }
        }

        return new_result({
            value: new_type({ type: TypeName.Enum, items: tys }),
            length: len
        });
    }

    if (tstr.startsWith("[") /* && tstr.endsWith("]") */) {
        tstr = tstr.substring(1);
        len += 1;

        let buffered_result = parse_buffered(tstr);
        let buffered = false;
        if (buffered_result != null) {
            buffered = true;
            tstr = tstr.substring(buffered_result.length);
            len += buffered_result.length;
        }

        let ty = parse_type(tstr);
        if (ty == null) { console.log("Failed to parse type, null type error", tstr); return null; }
        tstr = tstr.substring(ty.length);
        len += ty.length;

        if (tstr.startsWith(ss)) {
            tstr = tstr.substring(ss.length);
            len += ss.length;

            let buffered_result = parse_buffered(tstr);
            let buffered = false;
            if (buffered_result != null) {
                buffered = true;
                tstr = tstr.substring(buffered_result.length);
                len += buffered_result.length;
            }

            let array_len = parse_num(tstr);
            if (array_len == null) { console.log("Cannot parse array length, but found length sequence"); return null; }
            len += array_len.length;
            tstr = tstr.substring(array_len.length);

            if (tstr.startsWith("]")) { len += 1; }
            else { console.log("Missing closing bracket for array/vector"); return null; }

            if (buffered && !can_buffer(ty.value.type)) { console.log("Cannot buffer a complex type"); return null; }

            return new_result({
                value: new_type({
                    type: TypeName.Array,
                    item_type: ty.value,
                    length: array_len.value,
                    buffered
                }),
                length: len
            });
        }

        if (tstr.startsWith("]")) { len += 1; }
        else { console.log("Missing closing bracket for array/vector"); return null; }

        if (buffered && !can_buffer(ty.value.type)) { console.log("Cannot buffer a complex type"); return null; }

        return new_result({
            value: new_type({
                type: TypeName.Vector,
                item_type: ty.value,
                buffered
            }),
            length: len
        })
    } else if (tstr.startsWith(string)) {
        len += string.length;
        return new_result({
            value: new_type({ type: TypeName.String }),
            length: len
        })
    }

    return null;
}