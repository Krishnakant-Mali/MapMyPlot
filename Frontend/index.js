const TypingTagline = document.getElementById("TypingTagline");
const taglines = [
  "Accurate. Affordable. Transparent.",
  "Precision You Can Trust.",
];
let i = 0;
let j = 0;
let forward = true;

type = (i) => {
  TypingTagline.textContent= taglines[i].slice(0, j);
  if (forward == true) {
    j++;
    if (j <= taglines[i].length) {
      setTimeout(()=>type(i), 120)
    } 
    else {
      forward=false
      TypingTagline.classList.add("blink")
      setTimeout(()=>type(i),800)
    }
  }
  else{
    TypingTagline.classList.remove("blink")
    j--
    if(j<0){
      forward=true
      setTimeout(( ) => type((i+1)%taglines.length),0)
      j=0
    }
    else setTimeout(()=>type(i),50)
  }
};

type(i);
