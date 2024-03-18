const screen = document.getElementById('screen');
let state = "";
let key = [];

window.onkeydown = function(e) {
    key.push(e.key);
};

function preprocess(line, constants, macros) {
    for (let constant of Object.entries(constants)) {
        line = line.replaceAll("&" + constant[0], constant[1]);
    }

    const macroCalls = XRegExp.matchRecursive(line, '\\(', '\\)', 'g', { "unbalanced": "skip" });
    for (let args of macroCalls) {
        try {
            let name = /&([a-zA-Z_][a-zA-Z0-9_]*)\(/.exec(line);
            if (!name || line.indexOf("&" + name[1] + "(" + args + ")") === -1) throw null;
            name = name[1];
            let expansion = "";
            if (name == "repeat") {
                let match = null;
                let evaluatedArgs = preprocess(args, constants, macros);
                if (match = /^([0-9]+) ([^]*)$/.exec(evaluatedArgs)) {
                    expansion = "";
                    for (let i = 0; i < parseInt(match[1]); i++) {
                        expansion += preprocess(match[2], { "i": i, ...constants }, macros);
                    }
                } else throw null;
            } else if (name == "eval") {
                expansion = eval(preprocess(args, constants, macros));
            } else if (macros[name]) {
                expansion = preprocess(args.replace(
                    new RegExp(preprocess(macros[name][0], constants, macros)),
                    macros[name][1]
                ), constants, macros);
            } else throw null;
            line = line.replace("&" + name + "(" + args + ")", expansion);
        } catch (_) {
            line = line.replace("(" + args + ")", "(" + preprocess(args, constants, macros) + ")");
        }
    }
    return line;
}

function compile(code) {
    let preprocessed = "";
    {
        let constants = {};
        let macros = {};
        let segment = "";
        let appendConstant = null;
        let appendMacro = null;
        for (let line of code.split('\n')) {
            line = line.trim();
            if (line === "" || line.startsWith("#")) continue;
            if (appendConstant !== null) {
                constants[appendConstant] += line;
                if (line.endsWith("\\")) constants[appendConstant] = constants[appendConstant].slice(0, -1);
                else {
                    constants[appendConstant] = preprocess(constants[appendConstant], constants, macros);
                    appendConstant = null;
                }
            } else if (appendMacro !== null) {
                macros[appendMacro][1] += line;
                if (line.endsWith("\\")) macros[appendMacro][1] = macros[appendMacro][1].slice(0, -1);
                else appendMacro = null;
            } else if (line.startsWith(":")) {
                preprocessed += preprocess(segment, constants, macros);
                segment = "";

                let macro = [];
                if (macro = /:([a-zA-Z_][a-zA-Z0-9_]+)\s+(.+)$/.exec(line)) {
                    constants[macro[1]] = macro[2];
                    if (macro[2].endsWith("\\")) {
                        appendConstant = macro[1];
                        constants[macro[1]] = constants[macro[1]].slice(0, -1);
                    } else constants[macro[1]] = preprocess(constants[macro[1]], constants, macros);
                } else if (macro = /:([a-zA-Z_][a-zA-Z0-9_]+)\s*\/([^\/]*)\/\s*(.+)/.exec(line)) {
                    macros[macro[1]] = [macro[2], macro[3]];
                    if (macro[3].endsWith("\\")) {
                        appendMacro = macro[1];
                        macros[macro[1]][1] = macros[macro[1]][1].slice(0, -1);
                    }
                }
            } else segment += line;
        }
        preprocessed += preprocess(segment, constants, macros);
    }
    preprocessed = preprocessed
        .replaceAll(" ", "")
        .replaceAll("\n", "")
        .replaceAll("\t", "")
        .replaceAll("\\n", "\n")
        .replaceAll("\\s", " ");

    const separator = /\\.|(\/)/g;
    let parts = [];
    {
        let m;
        let lastIndex = null;
        while (m = separator.exec(preprocessed)) {
            if (m[1]) {
                if (lastIndex !== null) {
                    parts.push(preprocessed.substring(lastIndex + 1, m.index));
                }
                lastIndex = m.index;
            }
        }
        if (lastIndex !== null) {
            parts.push(preprocessed.substring(lastIndex + 1));
        }
    }

    let regexes = [];
    for (let i = 0; i < parts.length; i += 3) {
        regexes.push([parts[i], parts[i + 1], parts[i + 2]]);
        console.log(regexes[regexes.length - 1]);
    }
    return regexes;
}

function execute(code) {
    // console.log(state);
    if (state.indexOf("--memory") !== -1) {
        state = state.replace(/(--memory[^]*)\nkey:[a-zA-Z_0-9]+/g, "$1");
        if (key.length > 0) {
            state += "\nkey:" + key.splice(0)[0];
        }
    }
    for (let line of code) {
        state = state.replace(
            new RegExp(line[0], line[2]),
            line[1]
        );
    }
    screen.innerText = state.split("\n--memory\n")[0] || state;
}

var client = new XMLHttpRequest();
client.open('GET', 'game.regex');

var code = [];
var runner = null;
client.onreadystatechange = function() {
    let code = compile(client.responseText);
    if (runner !== null) clearInterval(runner);
    runner = setInterval(() => execute(code), 200);
};

client.send();
