import {
    BinaryExpr,
    NodeType,
    NumberLiteral,
    Expr,
    Identifier,
    BooleanLiteral,
    AssignmentExpr,
    CallExpr,
    FunctionExpr,
    PreUnaryExpr,
    BlockLiteral,
    StringLiteral,
    ListLiteral,
    IfExpr,
    ShiftExpr,
    isNodeType,
    WhileExpr,
    ForExpr,
    ForLoopType,
    ControlLiteral,
    CharacterLiteral,
    IndexExpr,
    MethodExpr,
    PostUnaryExpr,
    RangeExpr,
    PopExpr,
    PushExpr,
    ONE,
    NEG,
} from "../frontend/ast"
import {
    NULLVAL,
    NumberVal,
    RuntimeVal,
    TRUEVAL,
    FALSEVAL,
    FunctionVal,
    ValueType,
    NativeFunctionVal,
    isValueTypes,
    valueName,
    ListVal,
    BooleanVal,
    ControlVal,
    ControlType,
    CharacterVal,
    MKSTRING,
} from "./value"
import Enviroment from "./enviroment"
import { clamp, error, toggleScream } from "../utils"
import { BinaryOp } from "./binaryOp"
import { PostUnaryOp, PreUnaryOp } from "./UnaryOp"

//main eval function

export function evaluate(astNode: Expr, env: Enviroment): RuntimeVal {
    switch (astNode.type) {
        // literal
        case NodeType.NumberLiteral:
            return new NumberVal((astNode as NumberLiteral).number)
        case NodeType.NullLiteral:
            return NULLVAL
        case NodeType.BooleanLiteral:
            return (astNode as BooleanLiteral).value ? TRUEVAL : FALSEVAL
        case NodeType.StringLiteral:
            return MKSTRING((astNode as StringLiteral).string)
        case NodeType.CharacterLiteral:
            return new CharacterVal((astNode as CharacterLiteral).character)
        case NodeType.BlockLiteral:
            return evalBlock(astNode as BlockLiteral, env)
        case NodeType.ListLiteral:
            return evalListExpr(astNode as ListLiteral, env)
        case NodeType.ControlLiteral:
            return new ControlVal(
                (astNode as ControlLiteral).control as ControlType,
                (astNode as ControlLiteral).carryCount
            )

        // expr
        case NodeType.BinaryExpr:
            return evalBinExpr(astNode as BinaryExpr, env)
        case NodeType.Identifier:
            return evalIdentifier(astNode as Identifier, env)
        case NodeType.AssigmentExpr:
            return evalAssignmentExpr(astNode as AssignmentExpr, env)
        case NodeType.CallExpr:
            return evalCallExpr(astNode as CallExpr, env)
        case NodeType.FunctionExpr:
            return evalFuncExpr(astNode as FunctionExpr, env)
        case NodeType.PreUnaryExpr:
            return evalPreUnaryExpr(astNode as PreUnaryExpr, env)
        case NodeType.PostUnaryExpr:
            return evalPostUnaryExpr(astNode as PostUnaryExpr, env)
        case NodeType.IfExpr:
            return evalIfExpr(astNode as IfExpr, env)
        case NodeType.WhileExpr:
            return evalWhileExpr(astNode as WhileExpr, env)
        case NodeType.ForExpr:
            return evalForExpr(astNode as ForExpr, env)
        case NodeType.IndexExpr:
            return evalIndexExpr(astNode as IndexExpr, env)
        case NodeType.ShiftExpr:
            return evalShiftExpr(astNode as ShiftExpr, env)
        case NodeType.MethodExpr:
            return evalMethodExpr(astNode as MethodExpr, env)
        case NodeType.RangeExpr:
            return evalRangeExpr(astNode as RangeExpr, env)
        case NodeType.PopExpr:
            return evalPopExpr(astNode as PopExpr, env)
        case NodeType.PushExpr:
            return evalPushExpr(astNode as PushExpr, env)
        default:
            return error(`XperBug: This AST Node is not implemented in the interpreter:`, astNode)
    }
}

export function evalBlock(block: BlockLiteral, env: Enviroment, stack = false): RuntimeVal {
    let out: RuntimeVal = NULLVAL
    for (const expr of block.value) {
        const temp = evaluate(expr, env)
        if (isValueTypes(temp, ValueType.None)) continue
        out = temp
        if (stack) env.pushStack(out)
        if (isValueTypes(out, ValueType.Control)) {
            let control = out as ControlVal
            if (control.carryCount > 0) {
                control.carryCount -= 1
                return control
            } else {
                switch (control.value) {
                    case "break":
                        return NULLVAL
                    case "continue":
                        return TRUEVAL
                }
            }
        }
    }
    return env.getOut(out)
}

// other eval
function evalBinExpr(expr: BinaryExpr, env: Enviroment): RuntimeVal {
    return BinaryOp[expr.operator](evaluate(expr.leftHand, env), evaluate(expr.rightHand, env), env)
}

function evalPreUnaryExpr(expr: PreUnaryExpr, env: Enviroment): RuntimeVal {
    return PreUnaryOp[expr.operator](expr.expr, env)
}

function evalPostUnaryExpr(expr: PostUnaryExpr, env: Enviroment): RuntimeVal {
    return PostUnaryOp[expr.operator](expr.expr, env)
}

function evalIdentifier(iden: Identifier, env: Enviroment): RuntimeVal {
    return env.getVar(iden.symbol)
}

function evalAssignmentExpr(expr: AssignmentExpr, env: Enviroment): RuntimeVal {
    // duplicate the expr so we don't mess with the ast when changing it
    // expr = CloneObj(expr)
    if (!isNodeType(expr.lefthand, NodeType.Identifier, NodeType.IndexExpr))
        return error("SyntaxError: Invalid left-hand of assignment")
    if (expr.operator) {
        // this is a shallow copy and will modify the ast
        expr.rightHand = new BinaryExpr(expr.lefthand, expr.rightHand, expr.operator)
        delete expr.operator // delete the operator so the next time we encounter we don't fuck it
    }

    const value = evaluate(expr.rightHand, env)
    if (value.isConst) value.isConst = expr.isConst

    const limit = evaluate(expr.limit, env)
    if (!isValueTypes(limit, ValueType.Number))
        return error("TypeError: Variable limit must be type Number but given", valueName[limit.type])

    if (isNodeType(expr.lefthand, NodeType.Identifier)) {
        return env.assignVar((expr.lefthand as Identifier).symbol, value, expr.isConst, expr.isRef, limit as NumberVal)
    } else if (isNodeType(expr.lefthand, NodeType.IndexExpr)) {
        // get the important stuff
        const indexExpr = expr.lefthand as IndexExpr
        const indexable = evaluate(indexExpr.expr, env)
        let indexValue = [evaluate(indexExpr.index, env)]

        // make sure we can index
        if (!indexable.indexable) return error("TypeError: Cannot index type", valueName[indexable.type])
        if (!indexable.length) return error("XperBug: Length is not implemented on type", valueName[indexable.type])

        // make sure all the index are number
        if (isValueTypes(indexValue[0], ValueType.List)) indexValue = (indexValue[0] as ListVal).value
        if (!indexValue.every((v) => isValueTypes(v, ValueType.Number)))
            return error(
                "TypeError: Cannot index type",
                valueName[indexable.type],
                "with type",
                valueName[
                    (indexValue.find((v) => !isValueTypes(v, ValueType.Number)) ?? error("XperBug: Cannot find item"))
                        .type as keyof typeof valueName
                ]
            )

        // clean the index lsit to only be number
        const indexes: number[] = []

        if (indexValue.length > 1)
            for (const i of indexValue) {
                // get the number
                let indexNum = Math.round((i as NumberVal).value)

                if (!indexable.length)
                    return error("XperBug: Length is not implmented on type", valueName[indexable.type])

                //checking if index is valid
                if (indexNum < 0) indexNum = indexNum + indexable.length()

                indexNum = clamp(indexNum, 0, indexable.length()) // clamp the index in case out of bound

                indexes.push(indexNum)
            }
        else indexes.push(Math.round((indexValue[0] as NumberVal).value))

        // multi assign
        if (indexes.length > 1) {
            // make sure we have enough item
            if (!isValueTypes(value, ValueType.List))
                return error("TypeError: Expected right hand to be a List when assigning with multiple index")
            if ((value as ListVal).value.length !== indexes.length)
                return error(
                    "RuntimeError: Length mismatch when assigning with multiple index. Expected",
                    indexes.length,
                    "item but given",
                    (value as ListVal).value.length
                )
            for (const i in indexes) {
                indexable.value[indexes[i]] = (value as ListVal).value[i]
            }
        } else {
            // single assign
            indexable.value[indexes[0]] = value
        }
        return value
    }
    return error("SyntaxError: Invalid left-hand of assignment")
}

function evalCallExpr(caller: CallExpr, env: Enviroment): RuntimeVal {
    const args = caller.args.map((arg) => evaluate(arg, env))
    const func = evaluate(caller.caller, env)

    if (isValueTypes(func, ValueType.Function)) {
        const fn = func as FunctionVal
        const funcScope = env.clone()

        if (args.length != fn.parameter.length) {
            return error("Expected", fn.parameter.length, "argument but given", args.length)
        }

        // assign all the param var using the scope
        // this is so variable do not bleed out of the function scope
        for (const i in fn.parameter) {
            funcScope.assignVar(fn.parameter[i], args[i], false)
        }

        // actually evaluating the function body and return the output
        return evalBlock(fn.value, funcScope)
    } else if (isValueTypes(func, ValueType.NativeFuntion)) return (func as NativeFunctionVal).value(args, env)
    // ^^ comment for line above ^^
    // pass args and the env to native fucntion
    // native function don't need scope they only use the raw value
    else return error("TypeError:", func.value, "is not a Function")
}

function evalFuncExpr(func: FunctionExpr, env: Enviroment): RuntimeVal {
    return new FunctionVal(func.parameter, func.body, env)
}

function evalListExpr(list: ListLiteral, env: Enviroment): RuntimeVal {
    return new ListVal(list.items.map((e) => evaluate(e, env)))
}

function evalIfExpr(expr: IfExpr, env: Enviroment): RuntimeVal {
    const condition = evaluate(expr.condition, env)
    if (!isValueTypes(condition, ValueType.Boolean))
        return error("TypeError: Cannot evaluate if condition with type", valueName[condition.type])
    return evaluate((condition.value as boolean) ? expr.trueBlock : expr.falseBlock, env)
}

function evalShiftExpr(expr: ShiftExpr, env: Enviroment): RuntimeVal {
    if (!isNodeType(expr.rightHand, NodeType.Identifier, NodeType.IndexExpr))
        return error("SyntaxError: Cannot shift value")

    // this code abuse that error aren't actually error and are just log
    // use this fact to simmlify the value retrival
    toggleScream(false)
    let oldVal: RuntimeVal
    try {
        oldVal = evaluate(expr.rightHand, env.clone())
    } catch (err) {
        if (!(err instanceof Error)) throw err
        if (err.name !== "XperError") throw err
        oldVal = NULLVAL
    }
    toggleScream(true)
    evalAssignmentExpr(
        new AssignmentExpr(
            expr.rightHand,
            isNodeType(expr.leftHand, NodeType.Identifier, NodeType.IndexExpr)
                ? new PreUnaryExpr(expr.leftHand, "*")
                : expr.leftHand,
            undefined,
            false,
            false,
            NEG(ONE)
        ),
        env
    )
    return oldVal
}

function evalWhileExpr(expr: WhileExpr, env: Enviroment): RuntimeVal {
    let i = 0
    while (true) {
        const condition = evaluate(expr.condition, env) as BooleanVal
        if (!isValueTypes(condition, ValueType.Boolean)) {
            return error("TypeError: Cannot evaluate while condition with type", valueName[condition.type])
        }
        if (!condition.value) break
        const bodyVal = evaluate(expr.body, env)
        if (bodyVal === NULLVAL) break
        i++
        if (i > 5000) return error("YOUR LOOP TAKE TOO LONG M8 5000 ITERATION IS TOO MUCH")
    }
    return new NumberVal(i)
}

function evalForExpr(expr: ForExpr, env: Enviroment): RuntimeVal {
    if (expr.loopType === ForLoopType.Traditional) {
        evaluate(expr.init, env)
        let i = 0
        while (true) {
            const condition = evaluate(expr.condition, env) as BooleanVal
            if (!isValueTypes(condition, ValueType.Boolean)) {
                return error("TypeError: Cannot evaluate for loop condition with type", valueName[condition.type])
            }
            if (!condition.value) break
            const bodyVal = evaluate(expr.body, env)
            if (bodyVal === NULLVAL) break
            evaluate(expr.step, env)
            i++
            if (i > 5000) return error("YOUR LOOP TAKE TOO LONG M8 5000 ITERATION IS TOO MUCH")
        }
        return new NumberVal(i)
    } else {
        const evalEnumerable = evaluate(expr.enumerable, env)
        const isIn = expr.loopType === ForLoopType.In
        if (isIn ? !evalEnumerable.length : !evalEnumerable.enumerate) {
            return error(
                `TypeError: Cannot ${isIn ? "enumerate" : "iterate"} through type`,
                valueName[evalEnumerable.type]
            )
        }

        //@ts-expect-error Tell ts to stfu cus we already check for undefined
        let enumerable: RuntimeVal[] = isIn ? evalEnumerable.enumerate() : evalEnumerable.iterate()
        if (enumerable.length <= 0) return new NumberVal(0)
        for (const i of enumerable) {
            env.assignVar(expr.identifier, i, false)
            const bodyVal = evaluate(expr.body, env)
            if (bodyVal === NULLVAL) break
        }
        env.unsignVar(expr.identifier)
        return new NumberVal(enumerable.length)
    }
}

function evalIndexExpr(expr: IndexExpr, env: Enviroment): RuntimeVal {
    // get the value being index
    const value = evaluate(expr.expr, env)
    if (!value.indexable) return error("TypeError: Cannot index type", valueName[value.type])

    // evaluate the index
    let indexValue = [evaluate(expr.index, env)]
    if (isValueTypes(indexValue[0], ValueType.List)) indexValue = (indexValue[0] as ListVal).value
    if (!indexValue.every((v) => isValueTypes(v, ValueType.Number)))
        return error(
            "TypeError: Cannot index type",
            valueName[value.type],
            "with type",
            valueName[
                (indexValue.find((v) => !isValueTypes(v, ValueType.Number)) ?? error("XperBug: Cannot find item"))
                    .type as keyof typeof valueName
            ]
        )

    const out: RuntimeVal[] = []

    for (const index of indexValue) {
        let indexNum = Math.round((index as NumberVal).value)

        if (!value.length) return error("XperBug: Length is not implmented")

        //checking if index is valid
        if (indexNum < 0) indexNum = indexNum + value.length()
        if (indexNum >= value.length()) return error("RangeError: Index out of bound")

        out.push(value.value[indexNum])
    }

    return out.length > 1 ? new ListVal(out) : out[0]
}

function evalMethodExpr(expr: MethodExpr, env: Enviroment): RuntimeVal {
    const value = evaluate(expr.expr, env)

    if (!value.method) return error("TypeError: Type", valueName[value.type], "does not have any method")
    if (!(expr.method in value.method))
        return error("RuntimeError: Type", valueName[value.type], `does not have "${expr.method}"`)
    const args = expr.args.map((v) => evaluate(v, env))
    return value.method[expr.method](args, env)
}

function evalRangeExpr(range: RangeExpr, env: Enviroment): RuntimeVal {
    const value = [evaluate(range.start, env), evaluate(range.end, env), evaluate(range.step, env)]

    if (!value.every((v) => isValueTypes(v, ValueType.Number)))
        return error(
            "TypeError: All Range Expr value must be number but given",
            value.map((v) => valueName[v.type]).join(", ")
        )

    let [start, end, step] = (value as NumberVal[]).map((v) => v.value)
    const out = []
    let reverse = false
    if (end < start) {
        reverse = true
        ;[start, end] = [end, start]
    }
    if (step < 0) {
        reverse = true
        step *= -1
    }
    let v = start
    while (range.inclusive ? v <= end : v < end) {
        out.push(new NumberVal(v))
        v += step
    }

    if (reverse) out.reverse()
    return new ListVal(out)
}

function evalPopExpr(expr: PopExpr, env: Enviroment): RuntimeVal {
    const value = evaluate(expr.list, env)
    if (!isValueTypes(value, ValueType.List)) {
        return value
    } else {
        const listValue = value as ListVal
        let indexValue = [evaluate(expr.index, env)]
        if (isValueTypes(indexValue[0], ValueType.List)) indexValue = (indexValue[0] as ListVal).value
        if (!indexValue.every((v) => isValueTypes(v, ValueType.Number)))
            return error(
                "TypeError: Cannot index type",
                valueName[value.type],
                "with type",
                valueName[
                    (indexValue.find((v) => !isValueTypes(v, ValueType.Number)) ?? error("XperBug: Cannot find item"))
                        .type as keyof typeof valueName
                ]
            )

        if (!(indexValue as NumberVal[]).every((v) => v.value <= listValue.value.length)) {
            return error("RangeError: Index out of bound")
        }

        const indexNum = indexValue.map((v) => v.value)

        const out: RuntimeVal[] = []
        for (const index of indexNum) {
            out.push(...listValue.value.splice(index, 1))
        }
        return out.length > 1 ? new ListVal(out) : out[0]
    }
}

function evalPushExpr(expr: PushExpr, env: Enviroment): RuntimeVal {
    let list = evaluate(expr.list, env) as ListVal
    if (!isValueTypes(list, ValueType.List)) list = new ListVal([list])

    let indexValue = [evaluate(expr.index, env)]
    if (isValueTypes(indexValue[0], ValueType.List)) indexValue = (indexValue[0] as ListVal).value
    if (!indexValue.every((v) => isValueTypes(v, ValueType.Number)))
        return error(
            "TypeError: Cannot index type",
            valueName[list.type],
            "with type",
            valueName[
                (indexValue.find((v) => !isValueTypes(v, ValueType.Number)) ?? error("XperBug: Cannot find item"))
                    .type as keyof typeof valueName
            ]
        )

    const indexNum = (indexValue as NumberVal[]).map((v) =>
        clamp(
            Math.round(v.value) < 0 ? Math.round(v.value) + list.value.length + 1 : Math.round(v.value),
            0,
            list.value.length
        )
    )
    const value = evaluate(expr.value, env)

    if (indexNum.length > 1) {
        const isList = isValueTypes(value, ValueType.List)
        if (isValueTypes(value, ValueType.List))
            if (value.value.length !== indexNum.length)
                return error(
                    "RuntimeError: Length mismatch when assigning with multiple index. Expected",
                    indexNum.length,
                    "item but given",
                    (value as ListVal).value.length
                )
        for (const index in indexNum) {
            list.value.splice(indexNum[index], 0, isList ? value.value[index] : value)
        }
        return list
    } else {
        if (list === value) {
            const len = list.value.length
            list.value.push(...list.value.splice(0, (-((indexValue[0] as NumberVal).value % len) + len) % len))
        } else list.value.splice(indexNum[0], 0, value)
        return list
    }
}
