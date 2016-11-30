/*global require, exports */

(function () {
    "use strict";

    var child_process = require("child_process"),
        domainName = "builder-execute",
        domainManager,
        running;

    function exec(directory, command, callback) {
        running = child_process.exec(command, { cwd: directory}, function (err, stdout, stderr) {
            callback(err ? stderr : undefined, err ? undefined : stdout);
        });
        running.stdout.on("readable", function(data){
            domainManager.emitEvent(domainName, "input", data);
        });
        running.stdout.on("data", function (data){
            domainManager.emitEvent(domainName, "data", data);
        });
        running.stderr.on("data", function (data){
            domainManager.emitEvent(domainName, "error", data);
        });
    }

    function write(data, callback) {
        running.stdin.write(data + "\n", "utf-8", function () {
            callback(null);
        });
    }

    exports.init = function (DomainManager) {
        if (!DomainManager.hasDomain(domainName)) {
            DomainManager.registerDomain(domainName, {
                major: 0,
                minor: 1
            });
        }

        domainManager = DomainManager;

        DomainManager.registerCommand(domainName, "exec", exec, true, "Exec cmd",
            [
                {
                    name: "directory",
                    type: "string"
                },
                {
                    name: "command",
                    type: "string"
                }
            ],
            [{
                name: "stdout",
                type: "string"
            }]
        );
        DomainManager.registerCommand(domainName, "write", write, true, "Input a string",
            [{
                name: "data",
                type: "string"
            }],
            []
        );

        DomainManager.registerEvent(domainName, "input",
            [{
                name: "data",
                type: "string"
            }]
        );
        DomainManager.registerEvent(domainName, "data",
            [{
                name: "data",
                type: "string"
            }]
        );
        DomainManager.registerEvent(domainName, "error",
            [{
                name: "data",
                type: "string"
            }]
        );
    };

}());
