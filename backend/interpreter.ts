import {
    BinaryExpr,
    NodeType,
    NumberLiteral,
    Expr,
    Identifier,
    BooleanLiteral,
    AssignmentExpr,
    ObjectLiteral,
    CallExpr,
    FunctionLiteral,
    UnaryExpr,
    Block,
    MemberExpr,
} from "./ast"
import {
    NULLVAL,
    NumberVal,
    RuntimeVal,
    TRUEVAL,
    FALSEVAL,
    FunctionVal,
    ObjectVal,
    ValueType,
    NativeFunctionVal,
    isValueType,
} from "./value"
import Enviroment from "./enviroment"
import { error } from "./utils"
import { BinaryOp } from "./binaryOp"
import { PreUnaryOp } from "./UnaryOp"

//main eval function

export function evaluate(astNode: Expr, env: Enviroment): RuntimeVal {
    switch (astNode.type) {
        case NodeType.NumberLiteral:
            return new NumberVal((astNode as NumberLiteral).number)
        case NodeType.NullLiteral:
            return NULLVAL
        case NodeType.BooleanLiteral:
            return (astNode as BooleanLiteral).value ? TRUEVAL : FALSEVAL
        case NodeType.BinaryExpr:
            return evalBinExpr(astNode as BinaryExpr, env)
        case NodeType.Identifier:
            return evalIdentifier(astNode as Identifier, env)
        case NodeType.AssigmentExpr:
            return evalAssignExpr(astNode as AssignmentExpr, env)
        case NodeType.ObjectLiteral:
            return evalObjExpr(astNode as ObjectLiteral, env)
        case NodeType.CallExpr:
            return evalCallExpr(astNode as CallExpr, env)
        case NodeType.FunctionLiteral:
            return evalFuncExpr(astNode as FunctionLiteral, env)
        case NodeType.UnaryExpr:
            return evalUnaryExpr(astNode as UnaryExpr, env)
        case NodeType.BlockLiteral:
            return evalBlock(astNode as Block, env)
        case NodeType.MemberExpr:
            return evalMemberExpr(astNode as MemberExpr, env)
        default:
            return error(`This AST Node is not implemented in interpreter:`, astNode)
    }
}

export function evalBlock(block: Block, env: Enviroment, isGlobal = false): RuntimeVal {
    let out: RuntimeVal = NULLVAL
    const blockEnv = isGlobal ? env : new Enviroment(env)
    for (const expr of block.value) {
        out = blockEnv.pushStack(evaluate(expr, blockEnv))
    }
    return out
}

// other eval
function evalBinExpr(expr: BinaryExpr, env: Enviroment): RuntimeVal {
    const left = evaluate(expr.leftHand, env)
    const right = evaluate(expr.rightHand, env)
    return BinaryOp[expr.operator](left as RuntimeVal, right as RuntimeVal, env)
}

function evalUnaryExpr(expr: UnaryExpr, env: Enviroment): RuntimeVal {
    return PreUnaryOp[expr.operator](evaluate(expr.expr, env), env)
}

function evalIdentifier(iden: Identifier, env: Enviroment): RuntimeVal {
    return env.getVar(iden.symbol)
}

function evalAssignExpr(expr: AssignmentExpr, env: Enviroment): RuntimeVal {
    if (expr.lefthand.type === NodeType.Identifier) {
        return env.assingVar((expr.lefthand as Identifier).symbol, evaluate(expr.rightHand, env), expr.isConst)
    } else if (expr.lefthand.type === NodeType.MemberExpr) {
        const left = expr.lefthand as MemberExpr
        const obj = evaluate(left.object, env)
        if (!isValueType(obj, ValueType.Object)) {
            return error("Cannot access non object")
        }
        const prop = (left.member as Identifier).symbol
        const val = evaluate(expr.rightHand, env)
        ;(obj as ObjectVal).value.set(prop, val)
        return val
    }
    return error("Invalid Left Hand")
}

function evalObjExpr(obj: ObjectLiteral, env: Enviroment): RuntimeVal {
    const prop = new Map<string, RuntimeVal>()
    for (const { key, value } of obj.properties) {
        prop.set(key, value === undefined ? env.getVar(key) : evaluate(value, env))
    }
    return new ObjectVal(prop)
}

export function evalCallExpr(caller: CallExpr, env: Enviroment): RuntimeVal {
    const args = caller.args.map((arg) => evaluate(arg, env))
    const func = evaluate(caller.caller, env)

    if (isValueType(func, ValueType.Function)) {
        const fn = func as FunctionVal
        const scope = new Enviroment(env)

        if (args.length != fn.parameter.length) {
            return error("Expected", fn.parameter.length, "argument but given", args.length)
        }

        // make param var
        for (const i in fn.parameter) {
            scope.assingVar(fn.parameter[i], args[i], false)
        }

        return evalBlock(fn.value, scope)
    } else if (isValueType(func, ValueType.NativeFuntion)) return (func as NativeFunctionVal).value(args, env)
    else return error("Cannot call on non-function")
}

function evalFuncExpr(func: FunctionLiteral, env: Enviroment): RuntimeVal {
    return new FunctionVal(func.parameter, func.body, env)
}

function evalMemberExpr(expr: MemberExpr, env: Enviroment): RuntimeVal {
    const left = evaluate(expr.object, env)
    if (!isValueType(left, ValueType.Object)) {
        return error("Cannot access non object")
    }
    const prop = (expr.member as Identifier).symbol
    return (left as ObjectVal).value.get(prop) ?? error(`Propeties ${prop} does not exit on ${left.value}`)
}
