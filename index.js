const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const deckstrings = require('deckstrings');

const app = express();
const server = http.createServer(app);

const clientPath = `${__dirname}/client`;
console.log(`Serving static from ${clientPath}`);


app.use(express.static(clientPath));

const io = socketio(server);

/*
id: (String) {
  socket: Socket,
  deckcode: deckcode,
  deck: deck //Shuffled in order
}
*/
let clients = {};

let errorDescriptions = {
  '101': 'Deckcode error',
  '102': 'Invalid deckcode',
  '201': 'Mulligan error',
  '202': 'Invalid mulligan',
};

server.on('error', (e) => {
  console.error('Server error:', e);
});

var port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log('js-hearthstone-mulligan started on ' + port);
});

io.on('connection', (sock) => {
  try{
    let sockid = generateSocketId();
    console.log(`[${sockid}] connected!`);
    clients[sockid] = {};
    clients[sockid].socket = sock;
    sock.on('deckcode', (obj) => {
      try{
        console.log(`[${sockid}] submitted deck code.`);
        let deck = generateDeck(sockid, obj);
        if(deck){
          console.log(`[${sockid}] deck response.`);
          sock.emit('deck', deck);
        }
        else{
          let deckcode = obj.deckcode;
          if(!deckcode){
            deckcode = '';
          }
          processError(sockid, 102, deckcode);
        }
      }
      catch(e){
        processError(sockid, 101);
        console.log(e.stack);
      }
    });
    sock.on('mulligan', (obj) => {
      try{
        console.log(`[${sockid}] submitted mulligan.`);
        let deck = generateMulligan(sockid, obj);
        if(deck){
          console.log(`[${sockid}] mulligan response.`);
          sock.emit('mulligan_deck', deck);
        }
        else{
          processError(sockid, 202, JSON.stringify(obj));
        }
      }
      catch(e){
        processError(sockid, 201);
        console.log(e.stack);
      }
    });
    sock.on('disconnect', function() {
      try{
        console.log(`[${sockid}] disconnected!`);
        delete clients[sockid];
      }
      catch(e){
        console.error(`[${sockid}] On disconnect error`, e);
      }
   });
  }
  catch(e){
    console.error('On connect error', e);
  }
});

/*
input: {
  deckcode: String
}
output: {
  deck: Array [
    {
      id: String,
      url: String
    }
  ]
}
*/
function generateDeck(sockid, obj){
  let deckcode = obj.deckcode;
  clients[sockid].deckcode = deckcode;
  return tryGenerate(sockid, deckcode);
}

/*
input: {
  goingFirst: Boolean,
  opponent: String,
  mulligans: Array [
    //Contains the indexes of mulliganed cards
    int (0-3)
  ];
}
output: {
  deck: Array [
    {
      id: String,
      url: String
    }
  ]
}
*/
function generateMulligan(sockid, obj){
  let deckcode = clients[sockid].deckcode;
  let olddeck = clients[sockid].deck;
  if(!deckcode){
    //Haven't submitted first time, abort
    return null;
  }
  let mulligans = obj.mulligans;
  if(!mulligans){
    return null;
  }
  let goingFirst = obj.goingFirst;
  let openingHand = getOpeningHand(goingFirst, olddeck);
  //Submit mulligan data
  let data = {
    'sockid': sockid,
    'deckcode': deckcode,
    opponent: obj.opponent,
    'goingFirst': goingFirst,
    'openingHand': openingHand,
    'mulligans': mulligans
  };
  submitData(data);
  return tryGenerate(sockid, deckcode, olddeck, goingFirst, mulligans)
}

function tryGenerate(sockid, deckcode, olddeck, goingFirst, mulligans){
  let deck;
  try{
    deck = deckstrings.decode(deckcode);
  }
  catch(e){
    //Can't generate deck from code
    return null;
  }
  let deckArr;
  if(olddeck){
    deckArr = olddeck;
  }
  else{
    deckArr = deckArrayFromObj(deck);
  }
  deckArr = shuffleDeck(deckArr, goingFirst, mulligans);
  clients[sockid].deck = deckArr;
  //Find url from id
  let deckMap = deckArr.map(idval => {
    return {
      id: idval,
      url: urlFromId(idval)
    };
  });
  return {
    deck: deckMap
  };
}

function deckArrayFromObj(deckObj){
  let cards = deckObj.cards;
  let deckArr = [];
  for(let i = 0; i < cards.length; i++){
    let elem = cards[i];
    let id = elem[0];
    let amt = elem[1];
    for(let j = 0; j < amt; j++){
      deckArr.push(id);
    }
  }
  return deckArr;
}

function shuffleDeck(deckArr, goingFirst, mulligans){
  if(!mulligans){
    return shuffle(deckArr.slice());
  }
  else{
    let openingHandSize = 4;
    if(goingFirst){
      openingHandSize = 3;
    }
    let opener = deckArr.slice(0, openingHandSize);
    //Find replacements
    let nonOpener = deckArr.slice(openingHandSize);
    shuffle(nonOpener);
    let mulliganCount = mulligans.length;
    //Put replacements into new opening hand
    for(let i = 0; i < mulligans.length; i++){
      let index = mulligans[i];
      if(index >= openingHandSize){
        throw "Mulligan index more than hand size";
      }
      let val = opener[index];
      opener[index] = nonOpener[i];
      nonOpener[i] = val;
    }
    //Shuffle mulliganned cards
    shuffle(nonOpener);
    return opener.concat(nonOpener);
  }
}


function shuffle(a){
  let j, x, i;
  for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      x = a[i];
      a[i] = a[j];
      a[j] = x;
  }
  return a;
}

function getOpeningHand(goingFirst, deck){
  let end = 4;
  if(goingFirst){
    end = 3;
  }
  return deck.slice(0, end);
}

function urlFromId(id){
  //TODO Generate URL
  //console.log(`Generate url from id ${id}`);
  //return 'https://raw.githubusercontent.com/schmich/hearthstone-card-images/af12/pre/abominable-bowman.png';
  return 'nourl';
}

function submitData(obj){
  //TODO Implement database systems
  console.log(`Submit data: ${JSON.stringify(obj)}`);
}

// output: String
function generateSocketId(){
  let alphanumeric = '0123456789abcdefghijklmnopqrstuvwxyz';
  let length = 16;
  let tries = 0;
  while(tries < 1000000){
    let s = '';
    for(let i = 0; i < length; i++){
      let rand = Math.floor(Math.random() * alphanumeric.length);
      s = s + alphanumeric.charAt(rand);
    }
    if(!clients[s]){
      return s;
    }
    tries++;
  }
  throw "Cannot generate unique id!";
}

function processError(sockid, errorid, errorData){
  try{
    if(!sockid){
      sockid = '';
    }
    if(!errorid){
      errorid = 0;
    }
    if(!errorData){
      errorData = '';
    }
    let errorDescription = errorDescriptions[errorid.toString()];
    if(!errorDescription){
      errorDescription = 'Unknown error';
    }
    console.log(`[${sockid}] error ${errorid} ${errorDescription}${errorData ? (': ' + errorData): ''}`);
    let sock = clients[sockid];
    if(sock){
      sock.socket.emit('process_error', {
        info: errorDescription,
        code: errorid,
        data: errorData
      });
    }
    else{
      console.log(`[${sockid}] error no sock exists for id`);
    }
  }
  catch(e){
    console.log(`[${sockid}] error processing error ${errorid}`);
  }
}
