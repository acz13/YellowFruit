
/*---------------------------------------------------------
Merge two arrays of strings, ignoring case and whitespace
---------------------------------------------------------*/
function mergeArrays(a,b) {
  aLower = a.map((x) => { return x.trim().toLowerCase(); });
  bLower = b.map((x) => { return x.trim().toLowerCase(); });
  for(var i in b) {
    if(aLower.includes(bLower[i])) { a.push(b[i]); }
  }
  return a;
}

/*---------------------------------------------------------
Equality test for settings objects
---------------------------------------------------------*/
function settingsEqual(s1, s2) {
  return s1.powers == s2.powers && s1.negs == s2.negs &&
    s1.bonuses == s2.bonuses && s1.playersPerTeam == s2.playersPerTeam;
}

/*---------------------------------------------------------
Equality test for two games. Probably does more work than
necessary because round/team1/team2 should be unique
---------------------------------------------------------*/
function gameEqual(g1, g2) {
  if((g1 == undefined && g2 != undefined) || (g1 != undefined && g2 == undefined)) {
    return false;
  }
  return g1.round == g2.round && g1.tuhtot == g2.tuhtot &&
    g1.ottu == g2.ottu && g1.forfeit == g2.forfeit && g1.team1 == g2.team1 &&
    g1.team2 == g2.team2 && g1.score1 == g2.score1 && g1.score2 == g2.score2 &&
    g1.notes == g2.notes;
}

/*---------------------------------------------------------
Generate the data necessary for showing the abbreviated
standings table in the sidebar
---------------------------------------------------------*/
function getSmallStandings(myTeams, myGames, gamesPhase, groupingPhase, settings) {
  var summary = myTeams.map(function(item, index) {
    var obj =
      { teamName: item.teamName,
        division: item.divisions[groupingPhase], //could be 'noPhase'
        wins: 0,
        losses: 0,
        ties: 0,
        points: 0,
        bHeard: 0,
        bPts: 0,
        forfeits: 0,
      };
    return obj;
  }); //map
  for(var i in myGames) {
    var g = myGames[i];
    if(gamesPhase == 'all' || g.phases.includes(gamesPhase)) {
      var idx1 = _.findIndex(summary, function (o) {
        return o.teamName == g.team1;
      });
      var idx2 = _.findIndex(summary, function (o) {
        return o.teamName == g.team2;
      });
      if(g.forfeit) { //team1 is by default the winner of a forfeit
        summary[idx1].wins += 1;
        summary[idx2].losses += 1;
        summary[idx1].forfeits += 1;
        summary[idx2].forfeits += 1;
      }
      else { //not a forfeit
        if(+g.score1 > +g.score2) {
          summary[idx1].wins += 1;
          summary[idx2].losses += 1;
        }
        else if(+g.score2 > +g.score1) {
          summary[idx1].losses += 1;
          summary[idx2].wins += 1;
        }
        else { //it's a tie
          summary[idx1].ties += 1;
          summary[idx2].ties += 1;
        }
        summary[idx1].points += parseFloat(g.score1) - otPoints(g, 1, settings);
        summary[idx2].points += parseFloat(g.score2) - otPoints(g, 2, settings);
        summary[idx1].bHeard += bonusesHeard(g,1);
        summary[idx2].bHeard += bonusesHeard(g,2);
        summary[idx1].bPts += bonusPoints(g,1,settings);
        summary[idx2].bPts += bonusPoints(g,2,settings);
      }//else not a forfeit
    }//if game is in phase
  }//loop over games
  return summary;
}


// generate the old SQBS-style game summaries. Not currently used.
function oldScoreboardGameSummaries(myGames, roundNo, phase, settings) {
  var html = '';
  for(var i in myGames) {
    var g = myGames[i];
    if((phase == 'all' || g.phases.includes(phase)) && g.round == roundNo) {
      var linkId = 'R' + roundNo + '-' + g.team1.replace(/\W/g, '') + '-' +
        g.team2.replace(/\W/g, '');
      if(g.forfeit) {
        html += '<br><span id=\"' + linkId + '\"><font size=+1>' + g.team1 +
        ' defeats ' + g.team2 + ' by forfeit' + '</font></span><br>';
      }
      else {
        html += '<p>' + '\n';
        html += '<span id=\"' + linkId + '\"><font size=+1>';
        if(toNum(g.score1) >= toNum(g.score2)) {
          html += g.team1 + ' ' + g.score1 + ', ' + g.team2 + ' ' + g.score2;
        }
        else {
          html += g.team2 + ' ' + g.score2 + ', ' + g.team1 + ' ' + g.score1;
        }
        if(g.ottu > 0) {
          html += ' (OT)';
        }
        html += '</font></span><br>' + '\n' +
          '<font size=-1>' + '\n';
        html += g.team1 + ': ';
        for(var p in g.players1) {
          var [tuh, pwr, tn, ng] = playerSlashLine(g.players1[p]);
          html += p + ' ';
          if(settings.powers != 'none') {
            html += pwr + ' ';
          }
          html += tn + ' ';
          if(settings.negs == 'yes') {
            html += ng + ' ';
          }
          html += (powerValue(settings)*pwr + 10*tn + negValue(settings)*ng) + ', ';
        }
        html = html.substr(0, html.length - 2); //remove the last comma+space
        html += '<br>' + '\n';
        html += g.team2 + ': ';
        for(var p in g.players2) {
          var [tuh, pwr, tn, ng] = playerSlashLine(g.players2[p]);
          html += p + ' ';
          if(settings.powers != 'none') {
            html += pwr + ' ';
          }
          html += tn + ' ';
          if(settings.negs == 'yes') {
            html += ng + ' ';
          }
          html += (powerValue(settings)*pwr + 10*tn + negValue(settings)*ng) + ', ';
        }
        html = html.substr(0, html.length - 2); //remove the last comma+space
        html += '<br>' + '\n';
        if(settings.bonuses != 'none') {
          var bHeard = bonusesHeard(g, 1), bPts = bonusPoints(g, 1, settings);
          var ppb = bHeard == 0 ? 0 : bPts / bHeard;
          html += 'Bonuses: ' + g.team1 + ' ' + bHeard + ' ' + bPts + ' ' + ppb.toFixed(2) + ', ';
          bHeard = bonusesHeard(g, 2), bPts = bonusPoints(g, 2, settings);
          ppb = bHeard == 0 ? 0 : bPts / bHeard;
          html += g.team2 + ' ' + bHeard + ' ' + bPts + ' ' + ppb.toFixed(2) + '<br>' + '\n';
        }
        if(settings.bonuses == 'yesBb') {
          var bbHrd = bbHeard(g, 1, settings);
          var ppbb = bbHrd.toString()=='0,0' ? 0 : g.bbPts1 / bbHrdToFloat(bbHrd);
          html += 'Bonus Bouncebacks: ' + g.team1 + ' ' +
            bbHrdDisplay(bbHrd) + ' ' + toNum(g.bbPts1) + ' ' + ppbb.toFixed(2) + ', ';
          bbHrd = bbHeard(g, 2, settings);
          ppbb = bbHrd.toString()=='0,0' ? 0 : g.bbPts2 / bbHrdToFloat(bbHrd);
          html += g.team2 + ' ' + bbHrdDisplay(bbHrd) + ' ' + toNum(g.bbPts2) + ' ' +
            ppbb.toFixed(2)  + '<br>' + '\n';
        }
      }//else not a forfeit
    }//if we want to show this game
  }//loop over all games
  return html + '</font>' + '\n' + '</p>' + '\n';
}//scoreboardGameSummaries
