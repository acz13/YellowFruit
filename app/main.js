/**********************************************************************
  YellowFruit, a quiz bowl statkeeping application

  Andrew Nadig
  2019

  Main.js
  The Electron main process.

************************************************************************/
var electron = require('electron');
var dialog = electron.dialog;
var BrowserWindow = electron.BrowserWindow;
var Menu = electron.Menu;
var app = electron.app;
var ipc = electron.ipcMain;
var Path = require('path');
var mainMenu, mainMenuTemplate, reportMenu, reportMenuTemplate;
var reportWindow; //to show the html report
var currentFile = '';
var unsavedData = false;

/*---------------------------------------------------------
This if statement is part of the app packaging code. I
didn't write it.
---------------------------------------------------------*/
// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent(app)) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

//Set to 'production' to hide developer tools; otherwise set to anything else
process.env.NODE_ENV = 'dev';

/*---------------------------------------------------------
Load a new report window, or, if one is already open,
reload and focus it.
---------------------------------------------------------*/
function showReportWindow() {
  if(reportWindow != undefined && !reportWindow.isDestroyed()) {
    reportWindow.loadURL('file://' + __dirname + '/report_load_spinner.html');
    reportWindow.focus();
  }
  else {
    reportWindow = new BrowserWindow({
      width: 1050,
      height: 550,
      show: false,
      autoHideMenuBar: true,
      icon: Path.resolve(__dirname, '..', 'icons', 'banana.ico')
    }); //reportWindow

    // reportWindow.loadURL('file://' + __dirname + '/standings.html');
    reportWindow.loadURL('file://' + __dirname + '/report_load_spinner.html');
    reportWindow.setMenu(reportMenu);

    reportWindow.once('ready-to-show', function () { reportWindow.show(); });
  }
} //showReportWindow

/*---------------------------------------------------------
A small modal that loads a page about how to use the
search bar.
---------------------------------------------------------*/
function showSearchTips(focusedWindow) {
  var searchWindow = new BrowserWindow({
    width: 550,
    height: 300,
    show: false,
    parent: focusedWindow,
    modal: true,
    autoHideMenuBar: true,
    icon: Path.resolve(__dirname, '..', 'icons', 'banana.ico')
  });
  searchWindow.loadURL('file://' + __dirname + '/searchtips.html');
  searchWindow.setMenu(reportMenu);
  searchWindow.once('ready-to-show', ()=>{ searchWindow.show(); });
  searchWindow.once('close', () => { focusedWindow.focus(); }); //prevent flickering
}

/*---------------------------------------------------------
A small window with info about the application.
---------------------------------------------------------*/
function showAboutYF(focusedWindow) {
  var aboutWindow = new BrowserWindow({
    width: 550,
    height: 300,
    show: false,
    parent: focusedWindow,
    modal: true,
    autoHideMenuBar: true,
    icon: Path.resolve(__dirname, '..', 'icons', 'banana.ico')
  });
  aboutWindow.loadURL('file://' + __dirname + '/AboutYF.html');
  aboutWindow.setMenu(reportMenu);
  aboutWindow.once('ready-to-show', ()=>{ aboutWindow.show(); });
  aboutWindow.once('close', () => { focusedWindow.focus(); }); //prevent flickering
}

/*---------------------------------------------------------
Save the html stat reports to their respective files. The
user can select any page of the existing report in order
to replace all seven pages with new versions.
---------------------------------------------------------*/
function exportHtmlReport(focusedWindow) {
  dialog.showSaveDialog(focusedWindow,
    {filters: [{name: 'HTML Webpages', extensions: ['html']}]},
    (fileName) => {
      if(fileName == undefined) { return; }
      var fileStart = fileName.replace(/.html/i, '');
      fileStart = fileStart.replace(/_(standings|individuals|games|teamdetail|playerdetail|rounds|statkey)/i, '');
      focusedWindow.webContents.send('exportHtmlReport', fileStart);
    }
  );
}

/*---------------------------------------------------------
Attempt to export the data in SQBS format. The user may
then get a warning about losing some of their data.
---------------------------------------------------------*/
function trySqbsExport(focusedWindow) {
  focusedWindow.webContents.send('trySqbsExport');
}

/*---------------------------------------------------------
Prompt the user to select a file name for the SQBS file
export.
---------------------------------------------------------*/
function sqbsSaveDialog(focusedWindow) {
  dialog.showSaveDialog(focusedWindow,
    {filters: [{name: 'SQBS tournament', extensions: ['sqbs']}]},
    (fileName) => {
      if(fileName == undefined) { return; }
      focusedWindow.webContents.send('exportSqbsFile', fileName);
    }
  );
}

/*---------------------------------------------------------
Prompt the user to select a filename for the data
(YellowFruit, not SQBS format)
---------------------------------------------------------*/
function saveTournamentAs(focusedWindow) {
  dialog.showSaveDialog(focusedWindow,
    {filters: [{name: 'YellowFruit Tournament', extensions: ['yft']}]},
    (fileName) => {
      if(fileName != undefined) {
        currentFile = fileName;
        focusedWindow.webContents.send('saveTournamentAs', fileName);
      }
    }
  );
}

/*---------------------------------------------------------
Save the tournament. If we don't have a file to save to,
redirect to Save As.
---------------------------------------------------------*/
function saveExistingTournament(focusedWindow) {
  if(currentFile != '') {
    focusedWindow.webContents.send('saveExistingTournament', currentFile);
  }
  else{
    saveTournamentAs(focusedWindow);
  }
}

/*---------------------------------------------------------
Load a tournament from a file.
---------------------------------------------------------*/
function openTournament(focusedWindow) {
  var willContinue = true, needToSave = false;
  if(unsavedData) {
    [willContinue, needToSave] = unsavedDataDialog(focusedWindow, 'Open Tournament');
    if(needToSave) {
      saveExistingTournament(focusedWindow);
    }
  }
  if(willContinue) {
    dialog.showOpenDialog(focusedWindow,
      {filters: [{name: 'YellowFruit Tournament', extensions: ['yft']}]},
      (fileNameAry) => {
        if(fileNameAry != undefined) {
          currentFile = fileNameAry[0]; //open dialog doesn't allow selecting multiple files
          focusedWindow.webContents.send('openTournament', currentFile);
          unsavedData = false;
        }
      }
    );
  }
}

/*---------------------------------------------------------
Close the current tournament and start a new one. Prompt to
save the tournament if there's unsaved data. If it would be
a Save As situation, force to user to go back.
---------------------------------------------------------*/
function newTournament(focusedWindow) {
  var willContinue = true, needToSave = false;
  if(unsavedData) {
    [willContinue, needToSave] = unsavedDataDialog(focusedWindow, 'Create New Tournament');
    if(needToSave) {
      saveExistingTournament(focusedWindow);
    }
  }
  if(willContinue) {
    focusedWindow.webContents.send('newTournament');
    currentFile = '';
    focusedWindow.setTitle('New Tournament');
    unsavedData = false;
  }
}

/*---------------------------------------------------------
Prompt the user to select an SQBS file from which to
import rosters.
---------------------------------------------------------*/
function importRosters(focusedWindow) {
  dialog.showOpenDialog(focusedWindow,
    {filters: [{name: 'SQBS Tournament', extensions: ['sqbs']}]},
    (fileNameAry) => {
      if(fileNameAry != undefined) {
        focusedWindow.webContents.send('importRosters', fileNameAry[0]);
      }
    }
  );
}

/*---------------------------------------------------------
Prompt the user to select a YellowFruit tournament to
merge into the current file.
---------------------------------------------------------*/
function mergeTournament(focusedWindow) {
  dialog.showOpenDialog(focusedWindow,
    {filters: [{name: 'YellowFruit Tournament', extensions: ['yft']}]},
    (fileNameAry) => {
      if(fileNameAry != undefined) {
        focusedWindow.webContents.send('mergeTournament', fileNameAry[0]);
      }
    }
  );
}

/*---------------------------------------------------------
Generic dialog modal for warning the user there is
unsaved data.
---------------------------------------------------------*/
function unsavedDataDialog(focusedWindow, caption) {
  var choice, willContinue, needToSave;
  if(currentFile != '') {
    choice = dialog.showMessageBox(
      focusedWindow,
      {
        type: 'warning',
        buttons: ['&Save and continue', 'Continue without s&aving', 'Go ba&ck'],
        defaultId: 2,
        cancelId: 2,
        title: 'YellowFruit - ' + caption,
        message: 'You have unsaved data.'
      }
    );
    willContinue = choice != 2;
    needToSave = choice == 0;
  }
  else { //no current file
    choice = dialog.showMessageBox(
      focusedWindow,
      {
        type: 'warning',
        buttons: ['Continue without s&aving', 'Go ba&ck'],
        defaultId: 1,
        cancelId: 1,
        title: 'YellowFruit',
        message: 'You have unsaved data.'
      }
    );
    willContinue = choice == 0;
    needToSave = false;
  }
  return [willContinue, needToSave];
}

/*---------------------------------------------------------
Once there are no windows open, close the app entirely.
---------------------------------------------------------*/
app.on('window-all-closed', function() {
  app.quit();
});

/*---------------------------------------------------------
Prevent malicious actors from opening aribitrary web pages
from within the app, although that shouldn't be possible
in the first place.
---------------------------------------------------------*/
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});

/*---------------------------------------------------------
Initialize window and menubars, and set up ipc listeners
---------------------------------------------------------*/
app.on('ready', function() {
  var appWindow;
  appWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    show: false,
    title: 'YellowFruit - New Tournament',
    icon: Path.resolve(__dirname, '..', 'icons', 'banana.ico')
  }); //appWindow

  appWindow.loadURL('file://' + __dirname + '/index.html');

  appWindow.once('ready-to-show', function() {
    appWindow.show();
  }); //ready-to-show

  /*---------------------------------------------------------
  Warn user if exiting with unsaved data.
  ---------------------------------------------------------*/
  appWindow.on('close', function(e) {
    var willClose = true;
    if(unsavedData) {
      var choice = dialog.showMessageBox(
        appWindow,
        {
          type: 'warning',
          buttons: ['Quit &Anyway', 'Go Ba&ck'],
          defaultId: 1,
          cancelId: 1,
          title: 'YellowFruit',
          message: 'You have unsaved data.'
        }
      );
      willClose = choice == 0;
    }
    if(willClose) {
      if(reportWindow != undefined && !reportWindow.isDestroyed()) {
        reportWindow.close();
      }
    }
    else {
      e.preventDefault();
    }
  });//appwindow.on close

  /*---------------------------------------------------------
  Set the window title to the name of the file.
  ---------------------------------------------------------*/
  ipc.on('setWindowTitle', (event, arg) => {
    event.returnValue = '';
    appWindow.setTitle('YellowFruit - ' + arg);
  });

  /*---------------------------------------------------------
  Add an asterisk to the window title when there's unsaved
  data.
  ---------------------------------------------------------*/
  ipc.on('unsavedData', (event, arg) => {
    event.returnValue = '';
    if(!appWindow.getTitle().endsWith('*')) {
      appWindow.setTitle(appWindow.getTitle() + '*');
    }
    unsavedData = true;
  });

  /*---------------------------------------------------------
  Called after data is saved to a file.
  ---------------------------------------------------------*/
  ipc.on('successfulSave', (event, arg) => {
    event.returnValue = '';
    unsavedData = false;
  });

  /*---------------------------------------------------------
  Load the html report once the renderer process has finished
  writing the files
  ---------------------------------------------------------*/
  ipc.on('statReportReady', (event) => {
    event.returnValue = '';
    if(reportWindow != undefined) {
      reportWindow.focus();
      reportWindow.loadURL('file://' + __dirname + '/standings.html');
    }
  });

  /*---------------------------------------------------------
  When the user tries to delete a game, prompt them to
  confirm that they want to do this.
  ---------------------------------------------------------*/
  ipc.on('tryDelete', (event, message) => {
    event.returnValue = '';
    var choice = dialog.showMessageBox(
      appWindow,
      {
        type: 'warning',
        buttons: ['&Delete', 'Go Ba&ck'],
        defaultId: 1,
        cancelId: 1,
        title: 'YellowFruit',
        message: 'Are you sure you want to delete this game?\n\n' + message
      }
    );
    if(choice == 0) { event.sender.send('confirmDelete'); }
    else if(choice == 1) { event.sender.send('cancelDelete'); }
  });//on tryDelete

  /*---------------------------------------------------------
  Export data in SQBS format
  ---------------------------------------------------------*/
  ipc.on('exportSqbsFile', (event) => {
    event.returnValue = '';
    sqbsSaveDialog(appWindow);
  });

  /*---------------------------------------------------------
  If the user has games that can't be converted correctly
  to SQBS format, alert them to that fact.
  ---------------------------------------------------------*/
  ipc.on('confirmLossySQBS', (event, badGameAry) => {
    event.returnValue = '';
    var choice = dialog.showMessageBox(
      appWindow,
      {
        type: 'warning',
        buttons: ['Export &Anyway', '&Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'YellowFruit',
        message: 'The following games exceed SQBS\'s limit of eight players per team:\n\n' +
          badGameAry.join('\n') +
          '\n\nOnly the first eight players in these games will be used.'
      }
    );
    if(choice == 0) { sqbsSaveDialog(appWindow); }
  });//on confirmLossySQBS

  /*---------------------------------------------------------
  If the import failed, help the user troubleshoot.
  ---------------------------------------------------------*/
  ipc.on('sqbsImportError', (event, lineNo) => {
    event.returnValue = '';
    dialog.showMessageBox(
      appWindow,
      {
        type: 'error',
        buttons: ['OK'],
        defaultId: 0,
        cancelId: 0,
        title: 'Import error',
        message: 'Import failed. Encountered an error on line ' + lineNo +
          ' of the SQBS file.'
      }
    );
  });

  /*---------------------------------------------------------
  Conform that rosters were imported successfully.
  ---------------------------------------------------------*/
  ipc.on('rosterImportSuccess', (event, numImported, dupTeams) => {
    event.returnValue = '';
    var message = 'Imported ' + numImported + ' teams.\n\n';
    if(dupTeams.length > 0) {
      message += 'The following teams already exist and were not imported:\n\n' +
        dupTeams.join('\n');
    }
    dialog.showMessageBox(
      appWindow,
      {
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        cancelId: 0,
        title: 'Successful import',
        message: message
      }
    );
  });

  /*---------------------------------------------------------
  Tell the user that there's nothing to import because all
  of the teams in the sqbs file are already here.
  ---------------------------------------------------------*/
  ipc.on('allDupsFromSQBS', (event) => {
    event.returnValue = '';
    dialog.showMessageBox(
      appWindow,
      {
        type: 'warning',
        buttons: ['OK'],
        defaultId: 0,
        cancelId: 0,
        title: 'YellowFruit',
        message: 'No teams were imported because all teams in the file already exist.'
      }
    );
  });

  /*---------------------------------------------------------
  Show a message explaining why the merge failed.
  ---------------------------------------------------------*/
  ipc.on('mergeError', (event, errorString) => {
    event.returnValue = '';
    dialog.showMessageBox(
      appWindow,
      {
        type: 'error',
        buttons: ['OK'],
        defaultId: 0,
        cancelId: 0,
        title: 'Merge error',
        message: 'Tournaments were not merged:\n\n' + errorString
      }
    );
  });

  /*---------------------------------------------------------
  Show a summary of the merge.
  ---------------------------------------------------------*/
  ipc.on('successfulMerge', (event, newTeamCount, newGameCount, conflictGames) => {
    event.returnValue = '';
    var mergeSummary = 'Added ' + newTeamCount + ' new teams and ' + newGameCount +
      ' new games.';
    if(conflictGames.length > 0) {
      mergeSummary += '\n\nThe following games already exist and were not added:\n\n';
      for(var i in conflictGames) {
        var g = conflictGames[i];
        mergeSummary += 'Round ' + g.round + ': ' + g.team1 + ' vs. ' + g.team2 + '\n';
      }
    }
    dialog.showMessageBox(
      appWindow,
      {
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        cancelId: 0,
        title: 'Successful merge',
        message: mergeSummary
      }
    );
  });

  /*---------------------------------------------------------
  Set up the menu bar.
  ---------------------------------------------------------*/
  mainMenuTemplate = [
    {
      label: '&YellowFruit',
      submenu: [
        {
          label: 'View Full Report',
          accelerator: 'CmdOrCtrl+I',
          click(item, focusedWindow) {
            focusedWindow.webContents.send('compileStatReport');
            showReportWindow();
          }
        },
        {
          label: 'Export Full Report',
          accelerator: 'CmdOrCtrl+U',
          click(item, focusedWindow) {
            exportHtmlReport(focusedWindow);
          }
        },
        {
          label: 'Export as SQBS',
          accelerator: 'CmdOrCtrl+Y',
          click(item, focusedWindow) {
            trySqbsExport(focusedWindow);
          }
        },
        {type: 'separator'},
        {
          label: 'New Tournament',
          accelerator: 'CmdOrCtrl+N',
          click(item, focusedWindow) {
            newTournament(focusedWindow);
          }
        },
        {
          label: 'Import Rosters from SQBS',
          click(item, focusedWindow) {
            importRosters(focusedWindow);
          }
        },
        {
          label: 'Merge Tournament',
          click(item, focusedWindow) {
            mergeTournament(focusedWindow);
          }
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click(item, focusedWindow) {
            openTournament(focusedWindow);
          }
        },
        {
          label: 'Save As',
          click(item, focusedWindow) {
            saveTournamentAs(focusedWindow);
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click(item, focusedWindow) {
            saveExistingTournament(focusedWindow);
          }
        },
        {type: 'separator'},
        {role: 'close'},
      ]
    },{
      label: '&Edit',
      submenu: [
        {
          label: 'Add Team',
          accelerator: 'CmdOrCtrl+T',
          click(item,focusedWindow) {
            if (focusedWindow == appWindow) focusedWindow.webContents.send('addTeam');
          }
        },
        {
          label: 'Add Game',
          accelerator: 'CmdOrCtrl+G',
          click(item,focusedWindow) {
            if (focusedWindow == appWindow) focusedWindow.webContents.send('addGame');
          }
        }
      ]
    },{
        label: '&View',
        submenu: [
          {
            label: 'Search',
            accelerator: 'CmdOrCtrl+F',
            click (item, focusedWindow) {
              if(focusedWindow) focusedWindow.webContents.send('focusSearch');
            }
          },
          {type: 'separator'},
          {
            label: 'Previous Page',
            accelerator: 'CmdOrCtrl+Left',
            click (item, focusedWindow) {
              if(focusedWindow) focusedWindow.webContents.send('prevPage');
            }
          },
          {
            label: 'Next Page',
            accelerator: 'CmdOrCtrl+Right',
            click (item, focusedWindow) {
              if(focusedWindow) focusedWindow.webContents.send('nextPage');
            }
          },
          {type: 'separator'},
          {
            label: 'Previous Phase',
            accelerator: 'Alt+Left',
            click (item, focusedWindow) {
              if(focusedWindow) focusedWindow.webContents.send('prevPhase');
            }
          },
          {
            label: 'Next Phase',
            accelerator: 'Alt+Right',
            click (item, focusedWindow) {
              if(focusedWindow) focusedWindow.webContents.send('nextPhase');
            }
          }//,
          // {type: 'separator'},
          // {
          //   label: 'Reload',
          //   accelerator: 'CmdOrCtrl+R',
          //   click (item, focusedWindow) {
          //     if (focusedWindow) focusedWindow.reload()
          //   }
          // },
          // {
          //   label: 'Toggle Developer Tools',
          //   accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          //   click (item, focusedWindow) {
          //     if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          //   }
          // }
        ]
      },{
        label: '&Help',
        submenu: [
          {
            label: 'Search Tips',
            click (item, focusedWindow) {
              showSearchTips(focusedWindow);
            }
          },
          {
            label: 'About YellowFruit',
            click (item, focusedWindow) {
              showAboutYF(focusedWindow);
            }
          }
        ]
      }
  ]; // mainMenuTemplate

  // Add dev tools if not in production
  if(process.env.NODE_ENV !== 'production') {
    mainMenuTemplate.push({
      label: 'Dev Tools',
      submenu:[
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.reload()
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          }
        }
      ]
    });
  }

  reportMenuTemplate = [
    {
      label: 'YellowFruit',
      submenu: [{role: 'close'}]
    }
  ]; // reportMenuTemplate

  mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  reportMenu = Menu.buildFromTemplate(reportMenuTemplate);
  // Menu.setApplicationMenu(mainMenu);
  appWindow.setMenu(mainMenu);

}); //app is ready


///////////////////////////////////////////////////////////////////////////
// All code below this point was not written by me
///////////////////////////////////////////////////////////////////////////


//things that happen during (windows) install
function handleSquirrelEvent(application) {
    if (process.argv.length === 1) {
        return false;
    }

    const ChildProcess = require('child_process');
    const path = require('path');

    const appFolder = path.resolve(process.execPath, '..');
    const rootAtomFolder = path.resolve(appFolder, '..');
    const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
    const exeName = path.basename(process.execPath);

    const spawn = function(command, args) {
        let spawnedProcess, error;

        try {
            spawnedProcess = ChildProcess.spawn(command, args, {
                detached: true
            });
        } catch (error) {}

        return spawnedProcess;
    };

    const spawnUpdate = function(args) {
        return spawn(updateDotExe, args);
    };

    const squirrelEvent = process.argv[1];
    switch (squirrelEvent) {
        case '--squirrel-install':
        case '--squirrel-updated':
            // Optionally do things such as:
            // - Add your .exe to the PATH
            // - Write to the registry for things like file associations and
            //   explorer context menus

            // Install desktop and start menu shortcuts
            spawnUpdate(['--createShortcut', exeName]);

            setTimeout(application.quit, 1000);
            return true;

        case '--squirrel-uninstall':
            // Undo anything you did in the --squirrel-install and
            // --squirrel-updated handlers

            // Remove desktop and start menu shortcuts
            spawnUpdate(['--removeShortcut', exeName]);

            setTimeout(application.quit, 1000);
            return true;

        case '--squirrel-obsolete':
            // This is called on the outgoing version of your app before
            // we update to the new version - it's the opposite of
            // --squirrel-updated

            application.quit();
            return true;
    }
};
