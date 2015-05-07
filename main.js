/**
(c) by Victor Hornets
Allow to run build programs (such as running Python/Ruby/Node/etc scripts) from Brackets and display results in panel. It is possible to create own build systems via 'Edit>Edit Builder' menu item and editing opened JSON-file (you need to restart Brackets).
**/

/*jslint plusplus: true, vars: true, nomen: true */
/*global define, brackets, console, setTimeout */

define(function (require, exports, module) {
    "use strict";

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
        curOpenLang,
        cmd = '';

    var builders = JSON.parse(require('text!builder.json')),
        panel,
        panelHTML = require('text!brackets-builder-panel.html'),
        panelIsVisible = false;

    function _processCmdOutput(data) {
        data = JSON.stringify(data);
        data = data
          .replace(/\"/g, '')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\n/g, '\n')
          .replace(/\\n/g, '\n');
        return data;
    }
    
    function _baseName(str) {
       var base = new String(str).substring(str.lastIndexOf('/') + 1); 
        if(base.lastIndexOf(".") != -1)       
            base = base.substring(0, base.lastIndexOf("."));
       return base;
    }
    
    function _securePath(path) {
        if (path.indexOf(' ') == -1) {
            return path;
        } else {
            return '"' + path + '"';
        }
    }
    
    function _prepare(action) {
        CommandManager.execute("file.saveAll")
        $('#builder-panel .builder-content').html('');
        
        curOpenDir      = _securePath(DocumentManager.getCurrentDocument().file._parentPath);
        curOpenFile     = _securePath(DocumentManager.getCurrentDocument().file._path);
        curOpenFileName = _securePath(DocumentManager.getCurrentDocument().file._name);
        curOpenLang     = _securePath(DocumentManager.getCurrentDocument().language._name);
        
        nodeConnection.connect(true).fail(function (err) {
            console.error("[[Brackets Builder]] Cannot connect to node: ", err);
        }).then(function () {
            console.log('Building ' + curOpenLang + ' in ' + curOpenFile + '...\n');

            return nodeConnection.loadDomains([domainPath], true).fail(function (err) {
                console.error("[[Brackets Builder]] Cannot register domain: ", err);
            });
        }).then(function () {
            builders.forEach(function (el) {
                if (el.name.toLowerCase() === curOpenLang.toLowerCase()) {
                    cmd = el[action];
                }
            });

            cmd = cmd
                .replace(/\$PATH/g, curOpenDir)
                .replace(/\$FULL_FILE/g, curOpenFile)
                .replace(/\$BASE_FILE/g, _baseName(curOpenFileName))
                .replace(/\$FILE/g, curOpenFileName);
        }).then(function () {
            $('#builder-panel .command').html(cmd);
            nodeConnection.domains["builder.execute"].exec(curOpenDir, cmd)
            .fail(function (err) {
                $('#builder-panel .builder-content').html(_processCmdOutput(err));
                panel.show();
            })
            .then(function (data) {
                if(data != "") {
                    $('#builder-panel .builder-content').html(_processCmdOutput(data));
                    panel.show();
                }
            });
        }).done();
    }

    function compile() {
        _prepare('compile');        
    }

    function run() {
        _prepare('run');        
    }

    function runCompiled() {
        _prepare('runCompiled');        
    }

    AppInit.appReady(function () {
        panel = PanelManager.createBottomPanel("brackets-builder-panel", $(panelHTML), 100);
        $('#builder-panel .close').on('click', function () {
            panel.hide();
        });

        CommandManager.register('Handling Running', 'builder.run', run);
        CommandManager.register('Handling Compilation', 'builder.compile', compile);
        CommandManager.register('Handling Running Compiled', 'builder.runCompiled', runCompiled);

        KeyBindingManager.addBinding('builder.run', 'F9');
        KeyBindingManager.addBinding('builder.compile', 'F10');
        KeyBindingManager.addBinding('builder.runCompiled', 'F11');

        // Add menu item to edit .json file
        var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);

        menu.addMenuDivider();
        // Create menu item that opens the config .json-file
        CommandManager.register("Edit Builder", 'builder.open-conf', function () {
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
    });

}); 