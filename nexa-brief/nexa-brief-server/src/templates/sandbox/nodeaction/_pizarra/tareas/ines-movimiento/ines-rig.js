/* Inés: rig 2.5D de una sola textura, la ilustración original exacta.
   Las imágenes repetidas en SVG apuntan al MISMO archivo y son partes de un solo modelo;
   las poses mueven articulaciones, nunca sustituyen dibujos completos. */
const ASSET = "./assets/ines-reference.png";
const ART = `<image href="${ASSET}" x="0" y="0" width="1024" height="1536"/>`;

// Siluetas en coordenadas de la ilustración. El cuerpo usa el complemento exacto
// de estas áreas; las piezas articuladas usan la misma textura en esas áreas.
const HEAD = "M300 0 H730 V310 H565 L567 355 H405 L411 310 H300 Z";
// El borde interior sigue la silueta del torso y del pantalón. Así, al mover
// el brazo, el recorte no arrastra una franja del cuerpo ni deja un hueco.
const RIGHT_ARM = "M618 350 C650 368 665 410 675 455 C686 500 703 573 708 640 C717 680 722 711 722 750 C722 802 722 857 711 884 C698 900 671 901 640 890 C638 858 640 818 640 779 L641 734 C645 703 646 667 643 634 C641 590 640 548 637 508 C635 463 632 417 618 350 Z";
const LEFT_ARM = "M343 343 C319 365 315 412 302 457 C288 515 268 575 269 624 C262 661 273 695 305 715 L306 739 C310 749 312 756 313 762 C302 793 300 825 307 850 C316 879 342 893 365 884 C377 867 377 837 370 807 L367 753 C379 731 389 707 399 667 C412 626 409 578 404 538 C409 475 411 429 401 388 C386 362 367 348 343 343 Z";
const RIGHT_UPPER = "M618 350 C650 368 665 410 675 455 C686 500 703 573 708 640 L709 666 L644 666 C643 633 641 590 640 548 C637 508 635 463 632 417 C627 386 622 363 618 350 Z";
const RIGHT_FORE = "M643 625 L708 625 C713 666 701 715 683 733 L689 755 L648 755 C646 704 645 665 643 625 Z";
const RIGHT_HAND = "M648 728 C658 721 678 720 689 735 C704 770 716 815 715 849 C714 877 690 891 657 882 C648 865 648 824 649 779 Z";
const LEFT_UPPER = "M343 343 C319 365 315 412 302 457 C288 515 268 575 269 624 C262 659 273 691 305 715 L316 690 L399 683 C412 626 409 578 404 538 C409 475 411 429 401 388 C386 362 367 348 343 343 Z";
const LEFT_FORE = "M270 632 C275 660 274 691 305 715 L306 749 L369 755 C381 728 393 697 399 646 C361 626 311 627 270 632 Z";
const LEFT_HAND = "M305 728 C321 720 351 724 367 747 L370 807 C377 837 377 867 365 884 C342 893 316 879 307 850 C300 825 302 793 313 762 Z";

const SVG = `
<svg viewBox="0 0 1024 1536" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Inés, modelo articulado con la ilustración original">
  <defs>
    <clipPath id="bodyClip" clipPathUnits="userSpaceOnUse"><path d="M0 0 H1024 V1536 H0 Z ${HEAD} ${RIGHT_ARM} ${LEFT_ARM}" clip-rule="evenodd"/></clipPath>
    <clipPath id="headClip" clipPathUnits="userSpaceOnUse"><path d="${HEAD}"/></clipPath>
    <clipPath id="rUpperClip" clipPathUnits="userSpaceOnUse"><path d="${RIGHT_UPPER}"/></clipPath>
    <clipPath id="rForeClip" clipPathUnits="userSpaceOnUse"><path d="${RIGHT_FORE}"/></clipPath>
    <clipPath id="rHandClip" clipPathUnits="userSpaceOnUse"><path d="${RIGHT_HAND}"/></clipPath>
    <clipPath id="lUpperClip" clipPathUnits="userSpaceOnUse"><path d="${LEFT_UPPER}"/></clipPath>
    <clipPath id="lForeClip" clipPathUnits="userSpaceOnUse"><path d="${LEFT_FORE}"/></clipPath>
    <clipPath id="lHandClip" clipPathUnits="userSpaceOnUse"><path d="${LEFT_HAND}"/></clipPath>
    <filter id="groundBlur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="12"/></filter>
  </defs>
  <ellipse cx="508" cy="1485" rx="185" ry="14" fill="#555" opacity=".16" filter="url(#groundBlur)"/>
  <g id="rigRoot">
    <!-- Superficie interna de la manga. Queda tapada por la textura en reposo. -->
    <g id="rightSleeveBacking" fill="#d0cbc7" stroke="#242321" stroke-width="2.6" stroke-linejoin="round">
      <path d="M618 358 C650 374 669 421 679 472 C691 525 705 589 708 642 Q709 669 680 675 Q653 676 642 655 C638 619 637 578 634 540 C631 491 628 448 624 412 Q620 380 618 358 Z"/>
    </g>
    <path d="M412 360 Q377 353 366 401 L374 594 Q378 649 402 670 L419 634 L423 430 Z" fill="#d9d5d0"/>
    <g id="body" clip-path="url(#bodyClip)">${ART}</g>
    <g id="armLeftUpper">
      <g clip-path="url(#lUpperClip)">${ART}</g>
      <g id="armLeftFore">
        <g clip-path="url(#lForeClip)">${ART}</g>
        <g id="handLeft" clip-path="url(#lHandClip)">${ART}</g>
      </g>
    </g>
    <g id="armRightUpper">
      <g clip-path="url(#rUpperClip)">${ART}</g>
      <g id="armRightFore">
        <g clip-path="url(#rForeClip)">${ART}</g>
        <g id="handRight" clip-path="url(#rHandClip)">${ART}</g>
      </g>
    </g>
    <g id="head" clip-path="url(#headClip)">${ART}
      <g id="glasses" visibility="hidden" fill="none" stroke="#292725" stroke-width="4">
        <ellipse cx="472" cy="185" rx="29" ry="26"/><ellipse cx="549" cy="181" rx="29" ry="26"/>
        <path d="M501 181 Q512 174 520 179 M443 180 L422 175 M578 176 L594 171"/>
      </g>
    </g>
  </g>
</svg>`;

const JOINTS = {
  armRightUpper: [620, 401], armRightFore: [667, 645], handRight: [667, 742],
  armLeftUpper: [379, 402], armLeftFore: [325, 647], handLeft: [337, 742],
  head: [491, 314],
};

export function createInesRig(host, { glasses = false } = {}) {
  host.innerHTML = SVG;
  const svg = host.querySelector("svg");
  const nodes = Object.fromEntries(Object.keys(JOINTS).map(id => [id, svg.querySelector(`#${id}`)]));
  const root = svg.querySelector("#rigRoot");
  const rightSleeveBacking = svg.querySelector("#rightSleeveBacking");
  svg.querySelector("#glasses").setAttribute("visibility", glasses ? "visible" : "hidden");

  function setPose(pose = {}) {
    for (const [id, [x, y]] of Object.entries(JOINTS)) {
      nodes[id].setAttribute("transform", `rotate(${pose[id] || 0} ${x} ${y})`);
    }
    rightSleeveBacking.setAttribute("transform", nodes.armRightUpper.getAttribute("transform"));
    root.setAttribute("transform", `translate(${pose.x || 0} ${pose.y || 0}) rotate(${pose.lean || 0} 500 685)`);
    svg.style.transform = `perspective(1200px) rotateY(${pose.yaw || 0}deg)`;
  }

  setPose();
  return { element: svg, setPose };
}
