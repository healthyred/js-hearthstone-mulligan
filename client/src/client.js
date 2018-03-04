const sock = io();

sock.on('deck', (text) => {
  //TODO deck
  writeEvent(JSON.stringify(text));
});

sock.on('mulligan_deck', (text) => {
  //TODO mulligan
  writeEvent(JSON.stringify(text));
});

sock.on('process_error', (text) => {
  //TODO handle error
  writeEvent(JSON.stringify(text));
});

const sendData = (e) => {
  e.preventDefault();
  const input1 = document.querySelector('#command');
  const text1 = input1.value;
  input1.value = '';

  const input2 = document.querySelector('#data');
  const text2 = input2.value;
  input2.value = '';

  sock.emit(text1, JSON.parse(text2));
}

const writeEvent = (text) => {
  const parent = document.querySelector("#events");

  const el = document.createElement('li');
  el.innerHTML = text;

  parent.appendChild(el);
};

document
  .querySelector('#submit-form')
  .addEventListener('submit', sendData);
