// node scrapper.js dest=fixtures.html

const axios = require('axios'); // dependecie for http request  
const path = require('path');
const jsdom = require('jsdom'); // dependencie for creating json 
const minimist = require('minimist'); // dependecie for processing cmd argument
const fs = require('fs'); // inbult library in node for fileManipulation

const excel = require('excel4node');
const pdflib= require('pdf-lib');
const { create } = require('domain');



let args = minimist(process.argv);
let responsePromise= axios.get("https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results");

responsePromise.then(function(response){
    let html = response.data ;

     let dom = new jsdom.JSDOM(html);

     let document = dom.window.document ;

     let matches = [];// an empty matches array
     
     // let collect all the match block ( div ) whose class is match-score-block
     let matchdivs = document.querySelectorAll('div.match-score-block');// qurySelectorAll return array

     for(let i=0 ; i<matchdivs.length ; i++){
         let matchdiv = matchdivs[i] ; // one match div 

         let match = {
             t1 : "",
             t2 : "",

             t1s : "",
             t2s : "",

             result : ""
         };

         let teamNameP = matchdiv.querySelectorAll('div.name-detail > p.name');
         
         match.t1 = teamNameP[0].textContent;
         match.t2 = teamNameP[1].textContent ;

         let teamsScore = matchdiv.querySelectorAll('div.score-detail > span.score');
       
         if(teamsScore.length ==2){
             match.t1s = teamsScore[0].textContent;
             match.t2s = teamsScore[1].textContent ;

         }
         else if(teamsScore.length ==1){
             match.t1s = teamsScore[0].textContent ;
         }

         let resultspan = matchdiv.querySelector('div.status-text > span');

         match.result = resultspan.textContent ;
         
        matches.push(match);
         
     }

     let teams = [];
     for(let i=0 ; i<matches.length ; i++){
         // we need data in unique team and there all respective mathche will all team 
         putTeamsInTeamArrIfMissing(teams , matches[i]);
     }

     for(let i=0 ; i<matches.length ; i++){
         putMatchesInRespectiveTeam(teams, matches[i]);
     }
      
     let teamJson = JSON.stringify(teams);
     
     fs.writeFileSync('teams.json' , teamJson , 'utf-8');

     formExcelOfTeams(teams);
     formPdfScoreCard(teams);

}).catch(function(err){
    console.log(err);
});


function putTeamsInTeamArrIfMissing(teams , match){

   let t1idx = -1 ;

   for(let i=0 ; i<teams.length ; i++){
       if(teams[i].name == match.t1){
           t1idx = i;
           break ;
       }
   }

   if(t1idx == -1){
       teams.push({
           name : match.t1,
           match : []
       })
   } 

   let t2idx = -1 ;

   for(let i=0 ; i<teams.length ; i++){
       if(teams[i].name == match.t2){
           t2idx = i ;
           break ;
       }
   }

   if(t2idx == -1){
       teams.push (
           {
               name : match.t2 ,
               match :[]
           }
       )
   }

}

function putMatchesInRespectiveTeam(teams , match){
    let t1idx = -1 ;
    for(let i=0 ; i<teams.length ; i++){
        if(teams[i].name==match.t1){
            t1idx = i ;
            break;
        }
    }

    let team1 = teams[t1idx];

    team1.match.push({
        vs : match.t2 ,
        selfScore : match.t1s,
        opponentscore : match.t2s ,
        result : match.result
    })

    let t2idx = -1 ;

    for(let i=0 ; i<teams.length ; i++){
        if(teams[i].name == match.t2){
            t2idx = i;
            break ;
        }
    }

    let team2 = teams[t2idx];

    team2.match.push(
        {
            vs : match.t1,
            selfScore : match.t2s,
            opponentscore : match.t1s,
            result : match.result 
        }
    ) ;


}

function formExcelOfTeams ( teams){

    // adding workbook 
    let wb = new excel.Workbook();

    for(let i=0 ; i<teams.length ; i++){

        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1,1).string('Vs');
        sheet.cell(1,2).string('SelfScore');
        sheet.cell(1,3).string('Opponent');
        sheet.cell(1,4).string('Result')

            for(let j=0 ; j<teams[i].match.length ; j++){
               
                sheet.cell(2+j , 1).string(teams[i].match[j].vs);
                sheet.cell(2+j , 2).string(teams[i].match[j].selfScore);
                sheet.cell(2+j , 3).string(teams[i].match[j].opponentscore);
                sheet.cell(2+j , 4).string(teams[i].match[j].result);

            }

            wb.write('WorldCup2019.xlsx')
    }
}

// function for pdf creations

function formPdfScoreCard(teams){
  
    if(!fs.existsSync(args.root)){
        fs.mkdirSync(args.root);
    }

    for(let i=0 ; i<teams.length ; i++){
       
        let teamDirPath = path.join(args.root , teams[i].name);

        if(!fs.existsSync(teamDirPath)){
            fs.mkdirSync(teamDirPath);
        }

        for(let j=0 ; j<teams[i].match.length ; j++){
            
            let scorecardN = path.join(teamDirPath , teams[i].match[j].vs + '.pdf');

            createScoreCard(teams[i].name , teams[i].match[j] , scorecardN);
        }
    }
  
}

function createScoreCard(teamN , matchob , fileName){
    let t1 = teamN;
    let t2 = matchob.vs;
    let t1s = matchob.selfScore;
    let t2s = matchob.opponentscore;
    let result = matchob.result;

    let bytesOfPDFTemplate = fs.readFileSync("template.pdf");
    let pdfdocKaPromise = pdflib.PDFDocument.load(bytesOfPDFTemplate);
    pdfdocKaPromise.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);

        page.drawText(t1, {
            x: 320,
            y: 729,
            size: 8
        });
        page.drawText(t2, {
            x: 320,
            y: 715,
            size: 8
        });
        page.drawText(t1s, {
            x: 320,
            y: 701,
            size: 8
        });
        page.drawText(t2s, {
            x: 320,
            y: 687,
            size: 8
        });
        page.drawText(result, {
            x: 320,
            y: 673,
            size: 8
        });

        let finalPDFBytesKaPromise = pdfdoc.save();
        finalPDFBytesKaPromise.then(function(finalPDFBytes){
            fs.writeFileSync(fileName , finalPDFBytes);
        })
    });

}


