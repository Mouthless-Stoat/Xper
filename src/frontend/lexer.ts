import { error } from "../utils"

// token type
export enum TokenType {
    // Literal Type
    Number,
    Identifier,
    Null,
    Boolean,
    StringLiteral,
    ControlLiteral,
    CharacterLiteral,

    // keyword
    While,
    For,
    In,
    Of,

    // delimiter
    OpenParen,
    CloseParen,
    OpenBrace,
    CloseBrace,
    OpenBracket,
    CloseBracket,

    // symbol
    /// In use
    Comma,
    Colon,
    SemiColon,
    Equal,
    Dot,
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Omega,
    Greater,
    Lesser,
    Pi,
    Avagadro,
    Question,
    Exclamation,
    Octothorp,
    LeftDoubleAngle,
    RightDoubleAngle,
    Ampersand,

    /// not use
    Quote,
    Dollar,
    Tilde,
    Pipe,
    Caret,
    BackwardSlash,
    Backtick,

    // long symbol
    /// in use
    DoublePlus, // ++
    DoubleMinus, // --
    Bunny, // =:
    DoubleColon, // ::
    Walrus, // :=
    DoubleArrow, // =>
    Arrow, // ->
    GreaterEqual, // >=
    LesserEqual, // <=
    Equality, // ==
    And, // &&
    Or, // ||
    DoubleDot, // ..

    // not use
    Spaceship, // <=>
    DoubleSlash, // //
    DoubleStar, // **
    DoublePercent, // %%

    // special for handling
    EOF,
}

export class Token {
    type: TokenType
    value: string
    constructor(tokenType: TokenType, value: string) {
        this.type = tokenType
        this.value = value
    }

    isTypes(...tokenType: TokenType[]): boolean {
        return tokenType.some((t) => this.type === t)
    }
}

function isNamic(char: string): boolean {
    return !!char.match(/[a-zA-Z_]/g) // type coercion go brrrrrrr
}

function isNumeric(char: string): boolean {
    return !!char.match(/[0-9]/g)
}

function isSkip(char: string): boolean {
    return [" ", "\n", "\r", "\t"].includes(char)
}

// single char token
const charToken: Record<string, TokenType> = {
    "(": TokenType.OpenParen,
    ")": TokenType.CloseParen,
    "{": TokenType.OpenBrace,
    "}": TokenType.CloseBrace,
    "[": TokenType.OpenBracket,
    "]": TokenType.CloseBracket,
    ":": TokenType.Colon,
    ";": TokenType.SemiColon,
    ".": TokenType.Dot,
    "=": TokenType.Equal,
    ",": TokenType.Comma,
    "|": TokenType.Pipe,
    "'": TokenType.Quote,
    $: TokenType.Dollar,
    "&": TokenType.Ampersand,
    "#": TokenType.Octothorp,
    "+": TokenType.Plus,
    "-": TokenType.Minus,
    "*": TokenType.Star,
    "/": TokenType.Slash,
    "%": TokenType.Percent,
    "!": TokenType.Exclamation,
    "~": TokenType.Tilde,
    ω: TokenType.Omega,
    π: TokenType.Pi,
    L: TokenType.Avagadro,
    "?": TokenType.Question,
    ">": TokenType.Greater,
    "<": TokenType.Lesser,
    "^": TokenType.Caret,
    "`": TokenType.Backtick,
    "\\": TokenType.BackwardSlash,
}

// multichar token
const multiToken: Map<string, TokenType> = (() => {
    return new Map<string, TokenType>(
        [
            ...Object.entries({
                "<<": TokenType.LeftDoubleAngle,
                ">>": TokenType.RightDoubleAngle,
                "++": TokenType.DoublePlus,
                "--": TokenType.DoubleMinus,
                "::": TokenType.DoubleColon,
                "=>": TokenType.DoubleArrow,
                "->": TokenType.Arrow,
                ">=": TokenType.GreaterEqual,
                "<=": TokenType.LesserEqual,
                "<=>": TokenType.Spaceship,
                "==": TokenType.Equality,
                "&&": TokenType.And,
                "||": TokenType.Or,
                Nₐ: TokenType.Avagadro,
                "..": TokenType.DoubleDot,
                ":=": TokenType.Walrus,
                "=:": TokenType.Bunny,
            }),
        ].sort(([a, _], [b, __]) => a.length - b.length)
    )
})()

const keyword = {
    null: TokenType.Null,
    true: TokenType.Boolean,
    false: TokenType.Boolean,
    while: TokenType.While,
    for: TokenType.For,
    in: TokenType.In,
    of: TokenType.Of,
    break: TokenType.ControlLiteral,
    continue: TokenType.ControlLiteral,
}

// parse input into a list of token that can be use to generate an ast later
export function tokenize(source: string): Token[] {
    const tokens = Array<Token>()
    const src = source.split("")
    const push = (tokenType: TokenType, value = "") => tokens.push(new Token(tokenType, value))

    while (src.length > 0) {
        const char = src[0]
        const multichar = (() => {
            for (const [token, _] of multiToken) {
                if (src.slice(0, token.length).join("") === token) {
                    return token
                }
            }
            return false
        })()
        if (isSkip(char)) {
            src.shift()
        } else if (multichar) {
            push(multiToken.get(multichar) ?? 0, src.splice(0, multichar.length).join(""))
        } else if (charToken[char]) {
            push(charToken[char], src.shift())
        } else {
            const isNumber = isNumeric(char)
            const isString = char === '"'
            let acc = ""

            if (char === '"') {
                src.shift()
                while (src.length > 0 && src[0] !== '"') {
                    let char = src.shift()
                    if (char === "\\") {
                        char += src.shift()
                    } else if (char === "\n" || char === "\r") {
                        src.shift()
                        char = "\\n"
                    }
                    acc += char
                }
                if (src.shift() !== '"') {
                    return error("SyntaxError: Expected End of String")
                }
                push(TokenType.StringLiteral, acc)
                continue
            } else if (char === "@") {
                src.shift()
                let char = src.shift()
                if (char === "\\") {
                    char += src.shift()
                } else if (char === "\n" || char === "\r") {
                    src.shift()
                    char = "\\n"
                }
                push(TokenType.CharacterLiteral, char)
                continue
            }

            if (!isNumber && !isNamic(char) && !isString) {
                error("WHAT THE FUCK IS THIS", char, char.charCodeAt(0))
            }

            const condition = () => src.length > 0 && (isNumber ? isNumeric : isNamic)(src[0])
            while (condition()) acc += src.shift()

            if (isNumber) {
                push(TokenType.Number, acc)
            } else {
                if (typeof keyword[acc as keyof typeof keyword] === "number")
                    push(keyword[acc as keyof typeof keyword], acc)
                else push(TokenType.Identifier, acc)
            }
        }
        continue
    }

    push(TokenType.EOF, "EOF")
    return tokens
}
