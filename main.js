/*jslint plusplus: true, vars: true, nomen: true */
/*global define, brackets, console, setTimeout */

define(function (require, exports, module) {
    "use strict";

    var menuId = "extensions.bsb.menu";
    
    var AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Menus               = brackets.getModule("command/Menus"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        KeyBindingManager   = brackets.getModule('command/KeyBindingManager'),
        FileUtils           = brackets.getModule("file/FileUtils"),
        PanelManager        = brackets.getModule("view/PanelManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        nodeConnection      = new NodeConnection(),
        domainPath          = ExtensionUtils.getModulePath(module) + "domain";
    
    var curOpenDir,
        curOpenFile,
        curOpenFileName,
        curOpenLang;

    var builders = JSON.parse(require('text!builder.json')),
        panel,
        panelHTML = require('text!brackets-builder-panel.html'),
        panelIsVisible = false;

    function parseCommand(command) {
        return command
                    .replace(/\$PATH/g, curOpenDir)
                    .replace(/\$FULL_FILE/g, curOpenFile)
                    .replace(/\$BASE_FILE/g, baseName(curOpenFileName))
                    .replace(/\$FILE/g, curOpenFileName);
    }
    
    function processCmdOutput(data) {
        data = JSON.stringify(data);
        data = data
          .replace(/\"/g, '')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\n/g, '\n')
          .replace(/\\n/g, '\n');
        return data;
    }
    
    function baseName(str) {
       var base = new String(str).substring(str.lastIndexOf('/') + 1); 
        if(base.lastIndexOf(".") != -1)       
            base = base.substring(0, base.lastIndexOf("."));
       return base;
    }
    
    function securePath(path) {
        if (path.indexOf(' ') == -1) {
            return path;
        } else {
            return '"' + path + '"';
        }
    }
    
    function executeAction(action) {
        CommandManager.execute("file.saveAll")
        $('#builder-panel .builder-content').html('');
        
        curOpenDir      = securePath(DocumentManager.getCurrentDocument().file._parentPath);
        curOpenFile     = securePath(DocumentManager.getCurrentDocument().file._path);
        curOpenFileName = securePath(DocumentManager.getCurrentDocument().file._name);
        curOpenLang     = securePath(DocumentManager.getCurrentDocument().language._name);
        
        nodeConnection.connect(true).fail(function (err) {
            console.error("[[Brackets Builder]] Cannot connect to node: ", err);
        }).then(function () {
            console.log('Building ' + curOpenLang + ' in ' + curOpenFile + '...\n');

            return nodeConnection.loadDomains([domainPath], true).fail(function (err) {
                console.error("[[Brackets Builder]] Cannot register domain: ", err);
            });
        }).then(function () {
            var cmd = null;
            var foundLanguage = false;
            builders.forEach(function (el) {
                if (el.name.toLowerCase() === curOpenLang.toLowerCase()) {
                    foundLanguage = true;
                    cmd = el[action];
                }
            });

            if (cmd == null || foundLanguage == false) {
                if (foundLanguage) {
                    Dialogs.showModalDialog(
                        '', 
                        'Brackets Builder Extention', 
                        'It is very possible that this operation is not possible for current type of file.'
                    );
                } else {
                    Dialogs.showModalDialog(
                        '', 
                        'Brackets Builder Extention', 
                        'No run configuration for current file type. Go to Edit > Script Builder Configuration and add one.'
                    );
                }
            } else {
                cmd = parseCommand(cmd);
                var start = new Date();
                $('#builder-panel .command .text').html(cmd);
                $('#builder-panel .command .status').html("Running...");
                panel.show();
                $('#builder-panel .builder-content').empty();
                $("#builder-panel .builder-content").append("<div class=\"input\"></div>").children().append("<input type=\"text\">").children().on("keypress", function (event){
                    var input = $(event.target);
                    if(event.keyCode === 13){
                        nodeConnection.domains["builder-execute"].write(input.val());
                    }
                    if(event.keyCode === 3){
                        nodeConnection.domains["builder-execute"].kill();
                    }
                    $('#builder-panel .builder-content .input').before("<div class=\"inputed\">" + processCmdOutput(input.val()) + "</div>");
                    input.val("");
                }).focus();
                nodeConnection.domains["builder-execute"].exec(curOpenDir, cmd)
                .always(function (data) {
                    function buildRuntimeStatus(start) {
                        var duration = (new Date().getTime() - start.getTime()) / 1000;
                        return 'Finished in <b>' + duration + '</b>s';
                    }
                    $('#builder-panel .command .status').html(buildRuntimeStatus(start));
                    $('#builder-panel .builder-content .input').remove();
                    nodeConnection.disconnect();
                });
            }
        }).done();
    }

    function compile() {
        executeAction('compile');        
    }

    function run() {
        executeAction('run');        
    }

    function runCompiled() {
        executeAction('runCompiled');        
    }

    AppInit.appReady(function () {
        panel = PanelManager.createBottomPanel("brackets-builder-panel", $(panelHTML), 100);
        $('#builder-panel .close').on('click', function () {
            panel.hide();
        });

        CommandManager.register('Run', 'builder.run', run);
        CommandManager.register('Compile', 'builder.compile', compile);
        CommandManager.register('Run Compiled', 'builder.runCompiled', runCompiled);
        
        Menus.addMenu("Build", menuId, Menus.AFTER, Menus.AppMenuBar.NAVIGATE_MENU);
        var menu = Menus.getMenu(menuId);
        menu.addMenuItem("builder.run", "F9", Menus.BEFORE, "bsb.debug");
        menu.addMenuItem("builder.compile", "F10", Menus.BEFORE, "bsb.debug");
        menu.addMenuItem("builder.runCompiled", "F11", Menus.BEFORE, "bsb.debug");

        // Add menu item to edit .json file
        var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);

        menu.addMenuDivider();
        // Create menu item that opens the config .json-file
        CommandManager.register("Script Builder Configuration", 'builder.open-conf', function () {
            Dialogs.showModalDialog('', 'Brackets Builder Extention', 'You must restart Brackets after changing this file.');
            var src = FileUtils.getNativeModuleDirectoryPath(module) + "/builder.json";

            DocumentManager.getDocumentForPath(src).done(
                function (doc) {
                    DocumentManager.setCurrentDocument(doc);
                }
            );
        });

        menu.addMenuItem('builder.open-conf');

        // Load panel css
        ExtensionUtils.loadStyleSheet(module, "brackets-builder.css");

        nodeConnection.on("builder-execute:data", function (event, data){
            $('#builder-panel .builder-content .input').before("<div>" + processCmdOutput(data) + "</div>");
        });
        nodeConnection.on("builder-execute:error", function (event, data){
            $('#builder-panel .builder-content .input').before("<div>" + processCmdOutput(data) + "</div>");
        });
    });

});
