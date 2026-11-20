
/* Grunge Montaje — Lyric Video — variante de lyrics-grunge con línea de tiempo explícita: escenas dirigidas por datos (texto en tiza y pincel, glitch, papel rasgado, resumen final y cierre de marca). */
const NAME = "lyrics-grunge-montage";
const ACTIVE_ID = null;
const DEFAULT_CONFIG = {"activeId": "default", "configs": [{"id": "default", "description": "Lyric video grunge de rap con montaje dirigido: metraje B/N, papel rasgado, tiza y pincel, glitch y cierre de marca.", "audio": {"src": "assets/song.mp3"}, "lyricsUrl": "assets/lyrics.json", "lyricsFilter": {"minLogprob": -0.4, "drop": ["audio ?jungle", "envato", "subt[ií]tulos", "amara\\.org", "oriel"]}, "fonts": {"googleUrl": "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wdth,wght@62..125,100..900&family=Oswald:wght@300;500&display=swap"}, "palette": {"red": "#E8292E", "white": "#F1F1EF", "black": "#070707", "paper": "#EDEDEA", "ink": "#101010", "chalk": "#F5F5F2"}, "grades": {"bw": {"type": "duo", "dark": "#040404", "light": "#EDEDED", "contrast": 1.55}}, "media": [{"id": "tunnel", "type": "video", "src": "assets/media/tunnel-dance.mp4", "poster": "assets/media/tunnel-dance-1.jpg", "graded": {"bw": {"src": "assets/media/graded/tunnel-dance.bw.mp4", "poster": "assets/media/graded/tunnel-dance-1.bw.jpg"}}}, {"id": "street", "type": "video", "src": "assets/media/street-dance.mp4", "poster": "assets/media/street-dance-1.jpg", "graded": {"bw": {"src": "assets/media/graded/street-dance.bw.mp4", "poster": "assets/media/graded/street-dance-1.bw.jpg"}}}, {"id": "hoodie", "type": "video", "src": "assets/media/hoodie.mp4", "poster": "assets/media/hoodie-1.jpg", "graded": {"bw": {"src": "assets/media/graded/hoodie.bw.mp4", "poster": "assets/media/graded/hoodie-1.bw.jpg"}}}, {"id": "crowd", "type": "video", "src": "assets/media/crowd.mp4", "poster": "assets/media/crowd-1.jpg", "graded": {"bw": {"src": "assets/media/graded/crowd.bw.mp4", "poster": "assets/media/graded/crowd-1.bw.jpg"}}}, {"id": "breakdance", "type": "video", "src": "assets/media/breakdance.mp4", "poster": "assets/media/breakdance-1.jpg", "graded": {"bw": {"src": "assets/media/graded/breakdance.bw.mp4", "poster": "assets/media/graded/breakdance-1.bw.jpg"}}}, {"id": "night", "type": "video", "src": "assets/media/night-hoodie.mp4", "poster": "assets/media/night-hoodie-1.jpg", "graded": {"bw": {"src": "assets/media/graded/night-hoodie.bw.mp4", "poster": "assets/media/graded/night-hoodie-1.bw.jpg"}}}], "intro": {"enabled": true, "title": "Double Control", "artist": "Pista de demostración"}, "outro": {"enabled": true, "version": "v1", "title": "Gracias", "sub": "por ver", "feats": "Suscríbete · NodeMotion"}, "texture": {"grain": 0.1}, "debug": {"enabled": false}, "seed": 13, "timeOffsetSec": 0.22, "look": {"darkScale": 0.55, "haze": 0.06, "fogScale": 1.5, "fogSize": 55, "vignette": 0.42}, "strokeScale": 2.3, "timeline": [{"name": "s01", "t0": 0.0, "t1": 1.44, "bg": {"clip": "hoodie", "off": 1, "dark": 0.3, "edges": [{"side": "tr", "d": 0.62, "dy": 0.14, "j": 0.5, "at": 0.2}, {"side": "bottom", "d": 0.065, "j": 0.5, "at": 0.2}]}, "pieces": [{"k": "rect", "x": 0, "y": 0, "w": 1, "h": 1, "color": "#cfcfcc", "until": 0.22}, {"k": "text", "s": "Roll up 20,", "id": "l1", "intro": "artist", "font": "cd", "color": "red", "w": 0.86, "h": 0.2, "y": 0.29, "ls": 0.005, "in": "words", "wt": [0, 0, 0, 0, 0, 0], "gather": {"dx": 0.05, "dy": 0.11, "at": 0, "d": 0.3}, "grow": {"at": [0.08, 0.2, 0.32, 0.44, 0.5, 0.55], "d": 0.22, "from": 0.5, "ls0": 0.45}, "glow": true, "ghost": {"color": "red", "dx": -0.03, "op": 0.5, "blur": 2, "delay": 0.5}}, {"k": "text", "s": "Deep", "id": "deep", "intro": "title", "font": "ar", "color": "white", "w": 0.86, "h": 0.38, "y": 0.8, "ls": 0, "in": "spread", "ls0": 1.1, "d": 0.3, "at": 0.6, "move": {"at": 0.78, "d": 0.22, "to": {"y": 0.63}}, "weight": {"from": 300, "to": 900, "delay": 0.35, "d": 0.3}, "distress": false}, {"k": "chalk", "shape": "crown", "ref": "deep", "at": 1.0, "d": 0.25, "sw": 7, "by": -0.17, "cx": 0.04}, {"k": "chalk", "shape": "path", "color": "red", "at": 0.95, "d": 0.3, "sw": 10, "paths": [[[0.8, 0.49], [0.8, 0.58]], [[0.8, 0.49], [0.9, 0.49]], [[0.8, 0.49], [0.97, 0.64]]]}], "type": "intro"}, {"name": "s02", "t0": 1.44, "t1": 3.08, "bg": {"clip": "breakdance", "off": 2, "dark": 0.3, "edges": [{"side": "tr", "d": 0.2, "dy": 0.15, "until": 1.15}, {"side": "bl", "d": 0.3, "dy": 0.28, "color": "black", "at": 1.15}]}, "pieces": [{"k": "text", "s": "Low homie belt is", "id": "l2", "font": "cd", "color": "white", "w": 0.84, "h": 0.215, "y": 0.235, "ls": 0.01, "in": "words", "wt": [0.2, 0.2, 0.2, 0.2], "grow": {"at": [0.45, 0.65, 0.85, 1.05], "d": 0.2, "from": 0.4}, "at": 0.15}, {"k": "text", "s": "Snapped.", "id": "snap", "font": "ar", "color": "red", "w": 0.67, "h": 0.4, "y": 0.72, "ls": 0.04, "in": "fade", "d": 0.15, "at": 1.05, "until": 1.45, "weight": {"from": 200, "to": 500, "delay": 0.1, "d": 0.3}, "distress": false, "move": {"at": 1.45, "d": 0.12, "to": {"y": 0.84}}}, {"k": "chalk", "shape": "ellipse", "ref": "snap", "color": "white", "sw": 14, "at": 1.2, "d": 0.3, "rx": 0.66, "ry": 0.7, "until": 1.45}, {"k": "text", "s": "Snapped.", "font": "ar", "color": "red", "w": 0.86, "h": 0.42, "y": 0.86, "ls": 0.01, "in": "slam", "from": 1.15, "at": 1.45, "d": 0.12, "distress": false}]}, {"name": "s03", "t0": 3.08, "t1": 4.64, "bg": {"clip": "street", "off": 3, "dark": 0.3}, "pieces": [{"k": "text", "s": "Like", "id": "like", "font": "ex", "color": "red", "w": 0.62, "h": 0.12, "x": 0.55, "y": 0.17, "ls": 0.6, "in": "slam", "at": 0.12, "until": 1.0, "move": {"at": 0.3, "d": 0.25, "to": {"y": 0.5}}}, {"k": "text", "s": "Whoa", "id": "brawl", "font": "ex", "color": "white", "w": 0.4, "h": 0.1, "y": 0.76, "ls": 0.4, "in": "spread", "ls0": 0.9, "d": 0.3, "at": 0.18, "until": 1.0, "move": {"at": 0.3, "d": 0.25, "to": {"y": 0.55}}}, {"k": "chalk", "shape": "arrowUp", "box": {"x": 0.045, "y": 0.4, "w": 0, "h": 0.5}, "at": 0.15, "d": 0.3, "sw": 10, "until": 1.0}, {"k": "chalk", "shape": "arrowDown", "box": {"x": 0.94, "y": 0.05, "w": 0, "h": 0.55}, "at": 0.2, "d": 0.3, "sw": 10, "until": 1.0}, {"k": "chalk", "shape": "arrowUp", "box": {"x": 0.88, "y": 0.7, "w": 0, "h": 0.2}, "at": 0.45, "d": 0.25, "sw": 6, "until": 1.0}, {"k": "chalk", "shape": "tri", "box": {"x": 0.5, "y": 0.47}, "size": 0.12, "at": 0.4, "d": 0.25, "sw": 5, "until": 1.0}, {"k": "text", "s": "Put a hundred down", "id": "put", "font": "cd", "color": "red", "w": 0.8, "h": 0.2, "y": 0.55, "ls": 0.01, "in": "slam", "at": 1.07, "glow": true}, {"k": "chalk", "shape": "spiral", "ref": "put", "color": "white", "sw": 11, "at": 0.95, "d": 0.5, "bw": 0.3, "bx": 0.12, "until": 1.55}]}, {"name": "s04", "t0": 4.64, "t1": 5.0, "bg": {"clip": "night", "off": 1, "dark": 0.3, "edges": [{"side": "top", "d": 0.1, "j": 0.5}]}, "pieces": [{"k": "text", "s": "Put a hundred down", "id": "put", "font": "cd", "color": "red", "w": 0.8, "h": 0.2, "y": 0.55, "ls": 0.01, "glow": true, "ghost": {"color": "red", "dx": 0.02, "op": 0.4}, "out": {"at": 0.28, "fx": "smear", "d": 0.1}}, {"k": "chalk", "shape": "spiral", "ref": "put", "color": "white", "sw": 11, "at": -0.1, "d": 0.2, "bw": 0.3, "bx": 0.12, "until": 0.3}]}, {"name": "s05", "t0": 5.0, "t1": 5.4, "bg": {"clip": "tunnel", "off": 2, "dark": 0.3, "edges": [{"side": "tl", "d": 0.45, "dy": 0.2}, {"side": "br", "d": 0.3, "dy": 0.3}]}, "pieces": [{"k": "text", "s": "Put a hundred down", "id": "put", "font": "cd", "color": "red", "w": 0.62, "h": 0.07, "x": 0.5, "y": 0.6, "ls": 0.01, "glow": true, "distress": true}, {"k": "text", "s": "And", "font": "cd", "color": "white", "w": 0.1, "h": 0.07, "x": 0.08, "ax": 0, "y": 0.7, "in": "cut", "at": 0.15}]}, {"name": "s06", "t0": 5.4, "t1": 7.0, "bg": {"light": true, "edges": [{"side": "top", "d": 0.12, "j": 0.6, "color": "black"}, {"side": "br", "d": 0.5, "dy": 0.5, "at": 0.8, "color": "black"}]}, "pieces": [{"k": "text", "s": "Put a hundred down", "id": "put", "font": "ex", "color": "red", "w": 0.86, "h": 0.11, "y": 0.46, "ls": 0.08, "glow": true}, {"k": "chalk", "shape": "strike", "ref": "put", "color": "white", "sw": 8, "at": 0.1, "d": 0.2, "bw": 0.25, "bx": 0.23}, {"k": "text", "s": "And put us on the map.", "id": "map", "font": "cd", "color": "white", "w": 0.72, "h": 0.11, "y": 0.6, "ls": 0.01, "in": "words", "step": 0.1, "at": 0.2}, {"k": "chalk", "shape": "underline", "ref": "map", "color": "white", "sw": 5, "at": 0.95, "d": 0.3, "bw": 0.2, "bx": 0.6}, {"k": "chalk", "shape": "swoosh", "ref": "map", "color": "white", "sw": 5, "at": 1.05, "d": 0.3}, {"k": "glitch", "at": 1.3, "d": 0.25, "y0": 0.3, "y1": 0.7, "n": 6}]}, {"name": "s07", "t0": 7.0, "t1": 7.8, "bg": {"clip": "hoodie", "off": 4, "dark": 0.3}, "pieces": [{"k": "text", "s": "Like", "id": "like", "font": "cd", "color": "red", "w": 0.4, "h": 0.2, "y": 0.5, "ls": 0.01, "in": "slam", "at": 0.0, "move": {"at": 0.45, "d": 0.15, "to": {"y": 0.3}}, "scale": {"from": 1, "to": 1.9, "at": 0.45, "d": 0.15}}, {"k": "chalk", "shape": "brush", "ref": "like", "color": "white", "sw": 14, "at": 0.05, "d": 0.18, "dy": 0.5, "until": 0.55}, {"k": "text", "s": "Whoa!", "id": "wow", "font": "cd", "color": "white", "w": 0.6, "h": 0.45, "y": 0.78, "ls": 0.01, "in": "rise", "dy": 0.5, "at": 0.45, "d": 0.2}]}, {"name": "s08", "t0": 7.8, "t1": 11.4, "bg": {"clip": "night", "off": 0, "dark": 0.15, "fog": 0.8, "edges": [{"side": "top", "d": 0.07, "j": 0.6, "at": 1.6}, {"side": "bottom", "d": 0.12, "j": 0.6, "at": 2.4}]}, "pieces": [{"k": "text", "s": "Y'all ain't even know", "id": "a", "font": "cd", "color": "white", "w": 0.6, "h": 0.1, "y": 0.5, "ls": 0.01, "in": "words", "step": 0.17, "at": 0.4, "distress": true, "move": {"at": 1.6, "d": 0.2, "to": {"y": 0.3}}}, {"k": "chalk", "shape": "prev", "box": {"x": 0.08, "y": 0.5}, "size": 0.05, "at": 0.4, "d": 0.25, "sw": 5, "until": 2.3}, {"k": "chalk", "shape": "play", "box": {"x": 0.9, "y": 0.5}, "size": 0.08, "at": 0.45, "d": 0.25, "sw": 5, "until": 2.3}, {"k": "chalk", "shape": "bolt", "color": "red", "box": {"x": 0.62, "y": 0.35, "w": 0, "h": 0.2}, "at": 1.2, "d": 0.25, "sw": 11}, {"k": "text", "s": "The place I had", "id": "b", "font": "cd", "color": "red", "w": 0.6, "h": 0.09, "y": 0.52, "ls": 0.01, "in": "slam", "at": 1.4, "ghost": {"color": "red", "dx": 0.03, "op": 0.5}}, {"k": "text", "s": "to go,", "id": "c", "font": "cd", "color": "white", "w": 0.5, "h": 0.16, "y": 0.75, "in": "rise", "at": 2.3, "d": 0.2}, {"k": "chalk", "shape": "bolt", "color": "white", "box": {"x": 0.75, "y": 0.55, "w": 0, "h": 0.3}, "at": 1.8, "d": 0.25, "sw": 11}, {"k": "glitch", "at": 3.2, "d": 0.35, "y0": 0.1, "y1": 0.8, "n": 9}]}, {"name": "s09", "t0": 11.4, "t1": 14.0, "bg": {"clip": "street", "off": 1, "dark": 0.1, "edges": [{"side": "bottom", "d": 0.07, "j": 0.6, "until": 1.5}, {"side": "top", "d": 0.3, "j": 0.4, "until": 0.5, "color": "paper"}]}, "pieces": [{"k": "text", "s": "In my cell lost a part of me but", "id": "a", "font": "cd", "color": "red", "w": 0.9, "h": 0.16, "y": 0.2, "ls": 0.005, "in": "words", "step": 0.08, "at": 0.25, "glow": true, "ghost": {"color": "red", "dx": 0.02, "op": 0.5}}, {"k": "chalk", "shape": "line", "color": "white", "sw": 8, "at": 0.5, "d": 0.3, "x0": 0.04, "y0": 0.06, "x1": 0.96, "y1": 0.06, "until": 1.5}, {"k": "text", "s": "Now I won't lose control.", "id": "b", "font": "cd", "color": "white", "w": 0.8, "h": 0.13, "x": 0.07, "ax": 0, "y": 0.36, "in": "words", "step": 0.2, "at": 1.1}, {"k": "chalk", "shape": "frame", "box": {"x": 0.04, "y": 0.08, "w": 0.92, "h": 0.38}, "pad": 0, "at": 1.2, "d": 0.7, "sw": 12}]}, {"name": "s10", "t0": 14.0, "t1": 16.3, "bg": {"clip": "night", "off": 2, "dark": 0.1, "fog": 1.2}, "pieces": [{"k": "text", "s": "Like", "font": "ex", "color": "white", "w": 0.9, "h": 0.5, "y": 0.5, "ls": 0, "in": "slam", "at": 0.2, "until": 1.2, "from": 1.4, "move": {"at": 0.8, "d": 0.12, "to": {"y": 0.02}}}, {"k": "text", "s": "Foot", "font": "ex", "color": "red", "w": 0.62, "h": 0.3, "y": 0.5, "ls": 0.12, "in": "slam", "at": 0.8, "until": 1.6, "move": {"at": 1.2, "d": 0.12, "to": {"y": 0.08}}}, {"k": "text", "s": "Is on the", "font": "ex", "color": "white", "w": 0.92, "h": 0.24, "y": 0.5, "ls": 0.08, "in": "spread", "ls0": 0.5, "d": 0.18, "at": 1.2, "move": {"at": 1.6, "d": 0.12, "to": {"y": 0.95}}, "ghost": {"color": "red", "dx": 0.04, "op": 0.6}}, {"k": "text", "s": "Gas,", "id": "gas", "font": "cd", "color": "red", "w": 0.5, "h": 0.6, "y": 0.5, "ls": 0.08, "in": "slam", "at": 1.6, "ghost": {"color": "red", "dx": 0.02, "op": 0.5}}, {"k": "chalk", "shape": "bolt", "box": {"x": 0.12, "y": 0.5, "w": 0, "h": 0.12}, "at": 1.7, "d": 0.2, "sw": 6}, {"k": "chalk", "shape": "bolt", "box": {"x": 0.84, "y": 0.5, "w": 0, "h": 0.12}, "at": 1.75, "d": 0.2, "sw": 6}, {"k": "glitch", "at": 1.95, "d": 0.3, "n": 7}]}, {"name": "s11", "t0": 16.3, "t1": 17.0, "bg": {"clip": "night", "off": 3, "dark": 0.1}, "pieces": [{"k": "stack", "s": "My whole crew", "n": 5, "y": 0.5, "dy": 0.12, "font": "ex", "colors": ["white", "white", "red", "white", "white"], "w": 0.86, "h": 0.1, "ls": 0.04, "step": 0.04, "scales": [0.9, 0.95, 1, 0.95, 0.9], "at": 0.1, "ghost": {"color": "red", "dx": 0.02, "op": 0.5}}]}, {"name": "s12", "t0": 17.0, "t1": 18.6, "bg": {"clip": "night", "off": 4, "dark": 0.1}, "pieces": [{"k": "text", "s": "A hell risk.", "id": "r", "font": "cd", "color": "red", "w": 0.62, "h": 0.12, "y": 0.5, "ls": 0.005, "in": "slam", "at": 0.2, "glow": true, "ghost": {"color": "red", "dx": -0.02, "op": 0.5}}, {"k": "chalk", "shape": "cross", "box": {"x": 0.02, "y": 0.6, "w": 0.25, "h": 0.25}, "color": "white", "sw": 5, "at": 0.5, "d": 0.2, "n": 6}, {"k": "chalk", "shape": "cross", "box": {"x": 0.75, "y": 0.08, "w": 0.22, "h": 0.2}, "color": "white", "sw": 5, "at": 0.7, "d": 0.2, "n": 6}]}, {"name": "s13", "t0": 18.6, "t1": 19.8, "bg": {"clip": "night", "off": 5, "dark": 0.1}, "pieces": [{"k": "text", "s": "I want money,", "font": "th", "color": "white", "w": 0.72, "h": 0.15, "y": 0.5, "ls": 0.04, "in": "words", "step": 0.1, "at": 0.05, "out": {"at": 0.75, "fx": "smear", "d": 0.15}, "fw": 500}, {"k": "text", "s": "Cash,", "id": "cash", "font": "cd", "color": "red", "w": 0.3, "h": 0.12, "y": 0.43, "in": "slam", "at": 0.95, "glow": true}, {"k": "chalk", "shape": "ellipse", "ref": "cash", "color": "white", "sw": 12, "at": 1.05, "d": 0.3, "rx": 0.7, "ry": 0.85}]}, {"name": "s14", "t0": 19.8, "t1": 20.9, "bg": {"clip": "night", "off": 6, "dark": 0.1}, "pieces": [{"k": "text", "s": "Want it all,", "id": "w", "font": "cd", "color": "white", "w": 0.62, "h": 0.36, "x": 0.45, "y": 0.32, "ls": 0.01, "in": "words", "step": 0.2, "at": 0.2, "out": {"at": 0.9, "fx": "smear", "d": 0.15}}, {"k": "chalk", "shape": "ellipse", "ref": "w", "color": "white", "sw": 12, "at": 0.0, "d": 0.3, "bw": 0.4, "rx": 0.6, "ry": 0.6, "turns": 0.55, "a0": -1.2, "until": 0.6}]}, {"name": "s15", "t0": 20.9, "t1": 22.3, "bg": {"clip": "hoodie", "off": 1, "dark": 0.1}, "pieces": [{"k": "text", "s": "Selfish.", "id": "s", "font": "cd", "color": "red", "w": 0.86, "h": 0.38, "y": 0.65, "ls": 0.01, "in": "slam", "at": 0.1, "glow": true, "ghost": {"color": "red", "dx": 0.03, "op": 0.55}}, {"k": "chalk", "shape": "underline", "ref": "s", "color": "white", "sw": 14, "at": 0.7, "d": 0.4, "dy": 1.05}]}, {"name": "s16", "t0": 22.3, "t1": 23.0, "bg": {"clip": "night", "off": 7, "dark": 0.15}, "pieces": [{"k": "text", "s": "Never gave", "id": "n", "font": "cd", "color": "white", "w": 0.72, "h": 0.5, "y": 0.6, "in": "rise", "at": 0.05, "d": 0.2}, {"k": "chalk", "shape": "arrowUp", "box": {"x": 0.07, "y": 0.5, "w": 0, "h": 0.2}, "at": 0.1, "d": 0.2, "sw": 6}, {"k": "chalk", "shape": "arrowUp", "box": {"x": 0.85, "y": 0.58, "w": 0, "h": 0.2}, "at": 0.2, "d": 0.2, "sw": 6}]}, {"name": "s17", "t0": 23.0, "t1": 23.9, "bg": {"clip": "night", "off": 2, "dark": 0.65, "fog": 0.3}, "pieces": [{"k": "grid", "s": "F×K", "cols": 2, "rows": 6, "w": 0.5, "h": 0.92, "x0": 0.27, "y0": 0.04, "font": "ex", "colors": ["white", "white"], "fillW": 0.75, "fillH": 0.42, "ls": 0.2, "step": 0.03, "at": 0.15, "stagger": {"dir": "row"}}]}, {"name": "s18", "t0": 23.9, "t1": 26.5, "bg": {"clip": "tunnel", "off": 3, "dark": 1.2, "vig": 0.9, "fog": 0.15}, "pieces": [{"k": "text", "s": "I'm", "font": "ex", "color": "white", "w": 0.3, "h": 0.16, "x": 0.03, "ax": 0, "y": 0.2, "in": "slam", "at": 0.0}, {"k": "text", "s": "Better", "font": "th", "color": "red", "w": 0.18, "h": 0.12, "x": 0.62, "ax": 0, "y": 0.2, "at": 0.3, "fw": 400}, {"k": "text", "s": "Cannot help this", "id": "h", "font": "ex", "color": "white", "w": 0.66, "h": 0.13, "x": 0.3, "ax": 0, "y": 0.4, "ls": 0.06, "in": "slam", "at": 0.6, "ghost": {"color": "white", "dx": 0.03, "op": 0.35}}, {"k": "text", "s": "Caught up", "font": "cd", "color": "white", "w": 0.3, "h": 0.18, "x": 0.02, "ax": 0, "y": 0.62, "in": "slam", "at": 1.1, "op": 0.75, "ghost": {"color": "white", "dx": 0.02, "op": 0.4}}, {"k": "text", "s": "in my ways", "font": "th", "color": "red", "w": 0.5, "h": 0.18, "x": 0.42, "ax": 0, "y": 0.63, "in": "slam", "at": 1.3, "fw": 500, "glow": true}, {"k": "glitch", "at": 2.3, "d": 0.25, "n": 6, "redP": 0.2}]}, {"name": "s19", "t0": 26.5, "t1": 28.0, "bg": {"clip": "hoodie", "off": 0, "dark": 0.1, "edges": [{"side": "tl", "d": 0.5, "dy": 0.7, "j": 0.4}, {"side": "br", "d": 0.45, "dy": 0.35, "j": 0.4}]}, "pieces": [{"k": "text", "s": "Counting days till I'm fit", "id": "k", "font": "cd", "color": "white", "w": 0.52, "h": 0.07, "y": 0.5, "ls": 0.01, "in": "wipe", "d": 0.5, "at": 0.2}, {"k": "chalk", "shape": "arrowR", "ref": "k", "color": "red", "sw": 7, "at": 0.1, "d": 0.3, "len": 0.1}, {"k": "chalk", "shape": "ellipse", "ref": "k", "color": "red", "sw": 8, "at": 0.9, "d": 0.3, "bw": 0.25, "bx": 0.6, "rx": 0.65, "ry": 0.7}, {"k": "glitch", "at": 1.3, "d": 0.2, "y0": 0.3, "y1": 0.7, "n": 4}]}, {"name": "s20", "t0": 28.0, "t1": 28.35, "bg": {"clip": "street", "off": 1, "dark": 0.3, "edges": [{"side": "left", "d": 0.18, "j": 0.6, "at": 0.12}]}, "pieces": [{"k": "chalk", "shape": "crown", "box": {"x": 0.35, "y": 0.38, "w": 0.1, "h": 0.05}, "at": 0.0, "d": 0.2, "sw": 6}]}, {"name": "s21", "t0": 28.35, "t1": 28.75, "bg": {"clip": "night", "off": 1, "dark": 0.55}, "pieces": [{"k": "chalk", "shape": "xmark", "box": {"x": 0.5, "y": 0.42}, "size": 0.05, "at": 0.0, "d": 0.2, "sw": 9}]}, {"name": "s22", "t0": 28.75, "t1": 29.2, "bg": {"clip": "night", "off": 2, "dark": 0.55}, "pieces": [{"k": "chalk", "shape": "face", "box": {"x": 0.5, "y": 0.55}, "size": 0.1, "at": 0.0, "d": 0.3, "sw": 5}, {"k": "chalk", "shape": "line", "x0": 0.5, "y0": 0, "x1": 0.5, "y1": 0.4, "at": 0, "d": 0.25, "sw": 6}]}, {"name": "s23", "t0": 29.2, "t1": 29.85, "bg": {"clip": "hoodie", "off": 3, "dark": 0.1, "edges": [{"side": "top", "d": 0.1, "j": 0.6, "at": 0.4}]}, "pieces": [{"k": "chalk", "shape": "eyes", "box": {"x": 0.5, "y": 0.5}, "size": 0.06, "at": 0.0, "d": 0.2, "sw": 3}]}, {"name": "s24", "t0": 29.85, "t1": 30.95, "bg": {"clip": "breakdance", "off": 0, "dark": 0.2, "edges": [{"side": "bottom", "d": 0.15, "j": 0.6, "at": 0.5}]}, "pieces": [{"k": "text", "s": "Roll up 20,", "id": "a", "font": "ex", "color": "red", "w": 0.5, "h": 0.13, "y": 0.5, "ls": 0.1, "in": "slam", "at": 0.15, "out": {"at": 0.4, "fx": "cut"}}, {"k": "text", "s": "Deep low homie", "font": "cd", "color": "white", "w": 0.55, "h": 0.13, "y": 0.5, "in": "words", "step": 0.12, "at": 0.4}, {"k": "text", "s": "Belt is snapped", "font": "cd", "color": "red", "w": 0.4, "h": 0.05, "y": 0.6, "in": "fade", "at": 0.7, "d": 0.2, "glow": true}, {"k": "chalk", "shape": "tri", "box": {"x": 0.1, "y": 0.15}, "size": 0.05, "at": 0.3, "sw": 4}, {"k": "chalk", "shape": "next", "box": {"x": 0.92, "y": 0.53}, "size": 0.04, "at": 0.4, "sw": 4}, {"k": "chalk", "shape": "prev", "box": {"x": 0.13, "y": 0.9}, "size": 0.03, "at": 0.5, "sw": 4}]}, {"name": "s25", "t0": 30.95, "t1": 32.0, "bg": {"light": true}, "pieces": [{"k": "paper", "x": 0.0, "y": 0.28, "w": 1, "h": 0.34, "color": "black", "at": 0, "j": 0.05}, {"k": "text", "s": "Deep low homie", "font": "cd", "color": "white", "w": 0.5, "h": 0.11, "y": 0.39, "in": "words", "step": 0.08, "at": 0.1}, {"k": "text", "s": "Belt is snapped", "font": "ex", "color": "red", "w": 0.56, "h": 0.07, "y": 0.5, "ls": 0.06, "in": "fade", "d": 0.15, "at": 0.2}, {"k": "text", "s": "Belt is", "font": "cd", "color": "red", "w": 0.5, "h": 0.14, "y": 0.45, "in": "slam", "at": 0.78, "until": 0.78}]}, {"name": "s26", "t0": 32.0, "t1": 33.1, "bg": {"light": true}, "pieces": [{"k": "paper", "x": 0, "y": 0.25, "w": 1, "h": 0.4, "color": "black", "j": 0.05}, {"k": "text", "s": "Belt is snapped", "font": "ex", "color": "white", "w": 0.9, "h": 0.25, "y": 0.45, "ls": 0.04, "in": "slam", "at": 0.2, "until": 0.6, "ghost": {"color": "red", "dx": 0.04, "op": 0.6}}, {"k": "chalk", "shape": "slash", "box": {"x": 0.5, "y": 0.4, "w": 0.1, "h": 0.4}, "color": "red", "sw": 26, "at": 0.2, "d": 0.15, "until": 0.6, "ang": -65}, {"k": "text", "s": "Like", "font": "cd", "color": "red", "w": 0.14, "h": 0.1, "y": 0.45, "in": "cut", "at": 0.62}, {"k": "chalk", "shape": "slash", "box": {"x": 0.5, "y": 0.45, "w": 0.1, "h": 0.4}, "color": "white", "sw": 26, "at": 0.62, "d": 0.15, "ang": -62}]}, {"name": "s27", "t0": 33.1, "t1": 34.0, "bg": {"clip": "night", "off": 5, "dark": 0.4}, "pieces": [{"k": "text", "s": "Whoa", "font": "ex", "color": "red", "w": 0.9, "h": 0.55, "y": 0.5, "ls": 0, "in": "slam", "at": 0.15, "scale": {"from": 1, "to": 1.18, "at": 0.5, "d": 0.3}, "glow": true}]}, {"name": "s28", "t0": 34.0, "t1": 34.8, "bg": {"clip": "street", "off": 2, "dark": 0.5, "edges": [{"side": "left", "d": 0.28, "j": 0.5}]}, "pieces": [{"k": "stack", "s": "Put a hundred down", "n": 3, "y": 0.5, "dy": 0.22, "x": 0.55, "font": "cd", "colors": ["white"], "w": 0.56, "h": 0.2, "step": 0.15, "at": 0.2, "scales": [1, 1, 1]}]}, {"name": "s29", "t0": 34.8, "t1": 36.7, "bg": {"light": true, "edges": [{"side": "top", "d": 0.2, "j": 0.5, "color": "black"}, {"side": "bottom", "d": 0.1, "j": 0.5, "color": "black"}]}, "pieces": [{"k": "text", "s": "And", "font": "ex", "color": "white", "w": 0.42, "h": 0.3, "x": 0.3, "y": 0.36, "ls": 0, "in": "slam", "at": 0.5, "from": 1.3}, {"k": "text", "s": "Put us on", "font": "ex", "color": "red", "w": 0.78, "h": 0.14, "y": 0.56, "ls": 0.05, "in": "slam", "at": 0.9}, {"k": "text", "s": "The map", "font": "ex", "color": "white", "w": 0.85, "h": 0.09, "y": 0.74, "ls": 0.35, "in": "spread", "ls0": 0.8, "at": 1.2, "d": 0.3}, {"k": "glitch", "at": 1.65, "d": 0.25, "n": 5}]}, {"name": "s30", "t0": 36.7, "t1": 37.55, "bg": {"clip": "crowd", "off": 1, "dark": 0.3}, "pieces": [{"k": "text", "s": "Like", "font": "cd", "color": "red", "w": 0.62, "h": 0.95, "x": 0.35, "y": 0.5, "in": "slam", "at": 0.1, "glow": true}, {"k": "text", "s": "Whoa!", "font": "cd", "color": "white", "w": 0.5, "h": 0.9, "x": 0.74, "y": 0.5, "in": "slam", "at": 0.5}]}, {"name": "s31", "t0": 37.55, "t1": 38.45, "bg": {"clip": "street", "off": 3, "dark": 0.4}, "pieces": [{"k": "text", "s": "Y'all", "font": "cd", "color": "red", "w": 0.2, "h": 0.12, "x": 0.02, "ax": 0, "y": 0.5, "in": "slam", "at": 0.0}, {"k": "text", "s": "Ain't even know", "font": "cd", "color": "white", "w": 0.55, "h": 0.1, "x": 0.96, "ax": 1, "y": 0.5, "in": "slam", "at": 0.2}, {"k": "glitch", "at": 0.65, "d": 0.25, "n": 5}]}, {"name": "s32", "t0": 38.45, "t1": 40.45, "bg": {"clip": "breakdance", "off": 4, "dark": 0.35}, "pieces": [{"k": "stack", "s": "The", "n": 4, "y": 0.5, "dy": 0.2, "x": 0.03, "ax": 0, "font": "ex", "colors": ["white"], "w": 0.25, "h": 0.17, "step": 0.04, "at": 0.1}, {"k": "stack", "s": "Place I had to go", "n": 4, "y": 0.5, "dy": 0.2, "x": 0.97, "ax": 1, "font": "th", "fw": 500, "colors": ["red"], "w": 0.6, "h": 0.17, "step": 0.04, "at": 0.1}, {"k": "glitch", "at": 1.0, "d": 0.3, "n": 7}, {"k": "glitch", "at": 1.9, "d": 0.1, "n": 5}]}, {"name": "s33", "t0": 40.45, "t1": 41.2, "bg": {"clip": "tunnel", "off": 5, "dark": 0.3}, "pieces": [{"k": "text", "s": "Be my soul,", "font": "cd", "color": "red", "w": 0.86, "h": 0.45, "y": 0.62, "in": "slam", "at": 0.1, "glow": true}]}, {"name": "s34", "t0": 41.2, "t1": 42.1, "bg": {"clip": "street", "off": 5, "dark": 0.2}, "pieces": [{"k": "text", "s": "In my cell", "font": "cd", "color": "white", "w": 0.95, "h": 0.62, "y": 0.55, "in": "slam", "at": 0.0, "until": 0.5}, {"k": "text", "s": "Lost", "font": "cd", "color": "red", "w": 0.55, "h": 0.7, "y": 0.55, "in": "slam", "at": 0.5, "glow": true}]}, {"name": "s35", "t0": 42.1, "t1": 42.8, "bg": {"clip": "tunnel", "off": 6, "dark": 0.3}, "pieces": [{"k": "text", "s": "A part of me but", "font": "cd", "color": "white", "w": 0.98, "h": 0.55, "y": 0.45, "in": "slam", "at": 0.0, "until": 0.4}, {"k": "glitch", "at": 0.4, "d": 0.3, "n": 4}]}, {"name": "s36", "t0": 42.8, "t1": 44.2, "bg": {"clip": "tunnel", "off": 7, "dark": 0.3}, "pieces": [{"k": "text", "s": "Now I won't lose", "font": "cd", "color": "red", "w": 0.92, "h": 0.1, "y": 0.4, "ls": 0.1, "at": 0.0, "op": 0.8, "glow": true}, {"k": "text", "s": "Control", "font": "th", "color": "white", "w": 0.66, "h": 0.2, "y": 0.58, "ls": 0.2, "in": "slam", "at": 0.1, "ghost": {"color": "white", "dx": 0.02, "op": 0.3}, "fw": 400}]}, {"name": "s37", "t0": 44.2, "t1": 45.0, "bg": {"clip": "tunnel", "off": 8, "dark": 0.3}, "pieces": [{"k": "text", "s": "L", "font": "cd", "color": "red", "w": 0.06, "h": 0.11, "x": 0.5, "y": 0.2, "in": "slam", "at": 0.05, "until": 0.45}, {"k": "text", "s": "I", "font": "cd", "color": "red", "w": 0.06, "h": 0.11, "x": 0.5, "y": 0.39, "in": "slam", "at": 0.11, "until": 0.45}, {"k": "text", "s": "K", "font": "cd", "color": "red", "w": 0.06, "h": 0.11, "x": 0.5, "y": 0.5800000000000001, "in": "slam", "at": 0.16999999999999998, "until": 0.45}, {"k": "text", "s": "E", "font": "cd", "color": "red", "w": 0.06, "h": 0.11, "x": 0.5, "y": 0.77, "in": "slam", "at": 0.22999999999999998, "until": 0.45}, {"k": "grid", "s": "L", "cols": 6, "rows": 1, "w": 0.9, "h": 0.21, "x0": 0.05, "y0": 0.08, "font": "cd", "colors": ["white", "red", "red"], "fillW": 0.45, "fillH": 0.8, "step": 0.012, "at": 0.45}, {"k": "grid", "s": "I", "cols": 6, "rows": 1, "w": 0.9, "h": 0.21, "x0": 0.05, "y0": 0.29, "font": "cd", "colors": ["red", "red", "white"], "fillW": 0.45, "fillH": 0.8, "step": 0.012, "at": 0.48}, {"k": "grid", "s": "K", "cols": 6, "rows": 1, "w": 0.9, "h": 0.21, "x0": 0.05, "y0": 0.5, "font": "cd", "colors": ["white", "red", "red"], "fillW": 0.45, "fillH": 0.8, "step": 0.012, "at": 0.51}, {"k": "grid", "s": "E", "cols": 6, "rows": 1, "w": 0.9, "h": 0.21, "x0": 0.05, "y0": 0.71, "font": "cd", "colors": ["red", "red", "white"], "fillW": 0.45, "fillH": 0.8, "step": 0.012, "at": 0.54}]}, {"name": "s38", "t0": 45.0, "t1": 47.4, "bg": {"clip": "breakdance", "off": 6, "dark": 0.15, "edges": [{"side": "bottom", "d": 0.12, "at": 1.8}]}, "pieces": [{"k": "text", "s": "Roll", "font": "ex", "color": "white", "w": 0.96, "h": 0.1, "y": 0.55, "ls": 1.6, "in": "spread", "ls0": 2.2, "d": 0.3, "at": 0.0, "until": 0.6}, {"k": "text", "s": "Roll up 20,", "font": "ex", "color": "red", "w": 0.62, "h": 0.2, "x": 0.5, "y": 0.36, "in": "slam", "at": 0.75, "glow": true}, {"k": "text", "s": "Deep low", "font": "cd", "color": "white", "w": 0.5, "h": 0.16, "x": 0.52, "y": 0.56, "in": "slam", "at": 1.0}, {"k": "text", "s": "Belt is snapped", "font": "cd", "color": "red", "w": 0.48, "h": 0.12, "x": 0.52, "y": 0.7, "in": "slam", "at": 1.4}]}, {"name": "s39", "t0": 47.4, "t1": 48.3, "bg": {"clip": "crowd", "off": 2, "dark": 0.6}, "pieces": [{"k": "text", "s": "Like", "font": "ex", "color": "red", "w": 0.32, "h": 0.14, "y": 0.55, "in": "slam", "at": 0.15}, {"k": "glitch", "at": 0.45, "d": 0.3, "n": 8, "redP": 0.9}]}, {"name": "s40", "t0": 48.3, "t1": 49.0, "bg": {"clip": "night", "off": 4, "dark": 0.6, "edges": [{"side": "bottom", "d": 0.3, "j": 0.5, "at": 0.3}]}, "pieces": [{"k": "stack", "s": "Whoa", "n": 5, "y": 0.5, "dy": 0.15, "font": "ex", "colors": ["white"], "w": 0.5, "h": 0.12, "ls": 0.5, "step": 0.04, "at": 0, "scales": [1, 0.9, 0.6, 0.9, 1], "fitScale": true}]}, {"name": "s41", "t0": 49.0, "t1": 49.6, "bg": {"light": true}, "pieces": [{"k": "text", "s": "Put a hundred", "font": "cd", "color": "red", "w": 0.5, "h": 0.14, "y": 0.5, "in": "slam", "at": 0.15, "glow": true}]}, {"name": "s42", "t0": 49.6, "t1": 51.4, "bg": {"clip": "crowd", "off": 3, "dark": 0.55, "edges": [{"side": "bottom", "d": 0.2, "j": 0.5, "at": 1.4}]}, "pieces": [{"k": "text", "s": "Put a hundred down", "font": "cd", "color": "red", "w": 0.6, "h": 0.08, "y": 0.14, "glow": true}, {"k": "text", "s": "And put us", "font": "cd", "color": "white", "w": 0.86, "h": 0.34, "y": 0.45, "in": "slam", "at": 0.2}, {"k": "text", "s": "on the map.", "font": "cd", "color": "red", "w": 0.6, "h": 0.08, "y": 0.78, "in": "slam", "at": 0.7}, {"k": "glitch", "at": 1.3, "d": 0.3, "n": 6}]}, {"name": "s43", "t0": 51.4, "t1": 52.6, "bg": {"light": true}, "pieces": [{"k": "text", "s": "Like", "font": "ex", "color": "red", "w": 0.22, "h": 0.14, "x": 0.5, "y": 0.3, "in": "slam", "at": 0.5}, {"k": "text", "s": "Whoa!", "font": "cd", "color": "white", "w": 0.2, "h": 0.32, "x": 0.5, "y": 0.55, "in": "slam", "at": 0.7}, {"k": "chalk", "shape": "cross", "box": {"x": 0.5, "y": 0.4, "w": 0.4, "h": 0.3}, "color": "white", "sw": 3, "at": 0.6, "d": 0.2, "n": 9}]}, {"name": "s44", "t0": 52.6, "t1": 54.0, "bg": {"clip": "crowd", "off": 5, "dark": 0.35, "edges": [{"side": "top", "d": 0.15, "j": 0.5}, {"side": "bottom", "d": 0.15, "j": 0.5}]}, "pieces": [{"k": "text", "s": "Y'all ain't", "font": "cd", "color": "red", "w": 0.55, "h": 0.25, "y": 0.4, "in": "slam", "at": 0.2}, {"k": "text", "s": "even", "font": "cd", "color": "white", "w": 0.16, "h": 0.22, "x": 0.2, "y": 0.65, "in": "slam", "at": 0.5}, {"k": "text", "s": "know", "font": "cd", "color": "red", "w": 0.26, "h": 0.18, "x": 0.55, "y": 0.65, "in": "slam", "at": 0.6}]}, {"name": "s45", "t0": 54.0, "t1": 55.1, "bg": {"clip": "crowd", "off": 1, "dark": 0.4}, "pieces": [{"k": "stack", "s": "The place I had", "n": 3, "y": 0.5, "dy": 0.36, "font": "cd", "colors": ["white", "red", "white"], "w": 0.98, "h": 0.46, "step": 0.1, "at": 0.0, "scales": [1, 1.15, 1], "fitScale": true}]}, {"name": "s46", "t0": 55.1, "t1": 56.0, "bg": {"clip": "tunnel", "off": 9, "dark": 0.2, "edges": [{"side": "tl", "d": 0.35, "dy": 0.4}, {"side": "br", "d": 0.3, "dy": 0.3}]}, "pieces": [{"k": "text", "s": "To go,", "font": "ex", "color": "white", "w": 0.6, "h": 0.26, "y": 0.32, "in": "slam", "at": 0.15}, {"k": "text", "s": "Be my soul,", "font": "ex", "color": "red", "w": 0.82, "h": 0.26, "y": 0.64, "in": "slam", "at": 0.5, "glow": true}]}, {"name": "s47", "t0": 56.0, "t1": 56.6, "bg": {"clip": "street", "off": 6, "dark": 0.2}, "pieces": [{"k": "text", "s": "In my cell", "font": "ex", "color": "red", "w": 0.9, "h": 0.26, "y": 0.5, "in": "slam", "at": 0.0, "glow": true}, {"k": "glitch", "at": 0.35, "d": 0.2, "n": 4}]}, {"name": "s48", "t0": 56.6, "t1": 57.6, "bg": {"clip": "street", "off": 7, "dark": 0.2}, "pieces": [{"k": "grid", "s": "Lost a part of", "cols": 3, "rows": 3, "w": 1.1, "h": 0.84, "x0": -0.05, "y0": 0.08, "font": "ar", "colors": ["red"], "fillW": 0.95, "fillH": 0.55, "step": 0.05, "at": 0.0, "ls": 0.02, "drift": -0.04}]}, {"name": "s49", "t0": 57.6, "t1": 59.4, "bg": {"clip": "street", "off": 8, "dark": 0.3}, "pieces": [{"k": "grid", "s": "But now I won't lose", "cols": 3, "rows": 3, "w": 1.1, "h": 0.86, "x0": -0.05, "y0": 0.07, "font": "cd", "colors": ["white"], "fillW": 0.96, "fillH": 0.6, "step": 0.05, "at": 0.0, "drift": 0.04}, {"k": "glitch", "at": 1.3, "d": 0.4, "n": 8, "redP": 0}]}, {"name": "s50", "t0": 59.4, "t1": 61.4, "bg": {"clip": "street", "off": 9, "dark": 0.35, "edges": [{"side": "bottom", "d": 0.1}]}, "pieces": [{"k": "text", "s": "Control", "font": "ex", "color": "red", "w": 0.8, "h": 0.32, "y": 0.45, "in": "slam", "at": 0.0, "glow": true, "op": 0.92, "ghost": {"color": "red", "dx": 0.03, "op": 0.45}}, {"k": "glitch", "at": 1.2, "d": 0.3, "n": 5}]}, {"name": "s51", "t0": 61.4, "t1": 64.0, "bg": {"clip": "street", "off": 10, "dark": 0.25, "fog": 0.8}, "pieces": [{"k": "text", "s": "Roll up 20", "font": "cd", "color": "red", "w": 0.13951935655656966, "h": 0.05, "x": 0.8893562497238041, "y": 0.711110745771139, "at": 0.0, "out": {"at": 2.2912549953315837, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Deep low", "font": "cd", "color": "white", "w": 0.1375958567435717, "h": 0.05, "x": 0.2791663373343468, "y": 0.10563086325520593, "at": 0.02, "out": {"at": 1.2195918512231732, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Belt is snapped", "font": "cd", "color": "red", "w": 0.08465728326198303, "h": 0.05, "x": 0.5385095561276187, "y": 0.5650682453767286, "at": 0.04, "out": {"at": 1.018359865424463, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Like", "font": "cd", "color": "white", "w": 0.07820756637777787, "h": 0.05, "x": 0.823364002956736, "y": 0.40270483419635666, "at": 0.06, "out": {"at": 2.0666955986321405, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Whoa!", "font": "cd", "color": "white", "w": 0.24349050409322331, "h": 0.1, "x": 0.17149532464423733, "y": 0.061561878738230484, "at": 0.08, "out": {"at": 2.219966642613995, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Put a hundred down", "font": "cd", "color": "white", "w": 0.15601271002174996, "h": 0.05, "x": 0.2059536693075212, "y": 0.2065063400163393, "at": 0.1, "out": {"at": 1.439111914828935, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Do not", "font": "cd", "color": "white", "w": 0.12778304772505922, "h": 0.05, "x": 0.24020597278973768, "y": 0.888058880957439, "at": 0.12, "out": {"at": 1.9668987175496715, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "On the map", "font": "cd", "color": "red", "w": 0.09611899347223841, "h": 0.05, "x": 0.2060413302741761, "y": 0.18821768039580059, "at": 0.14, "out": {"at": 1.0911955987259467, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Y'all ain't even know", "font": "cd", "color": "red", "w": 0.1186141258503371, "h": 0.05, "x": 0.5844614764793377, "y": 0.682755014131585, "at": 0.16, "out": {"at": 1.092431430771508, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "The place I had to go", "font": "cd", "color": "red", "w": 0.1080745186630039, "h": 0.05, "x": 0.3378979331448707, "y": 0.48347217988844016, "at": 0.18, "out": {"at": 1.9865367877972728, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "To go", "font": "cd", "color": "white", "w": 0.1539011804929864, "h": 0.05, "x": 0.8953140194700628, "y": 0.37472677725177383, "at": 0.2, "out": {"at": 1.5660117136336456, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Be my soul", "font": "cd", "color": "red", "w": 0.11785188290568746, "h": 0.05, "x": 0.06798898040118502, "y": 0.10111986445506854, "at": 0.22, "out": {"at": 1.253287283131467, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "In my cell", "font": "cd", "color": "white", "w": 0.16921735812672273, "h": 0.1, "x": 0.7811539866700661, "y": 0.46674071716558924, "at": 0.24, "out": {"at": 1.7174944169574267, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Lost a part of me", "font": "cd", "color": "red", "w": 0.07080528690648329, "h": 0.05, "x": 0.7185902897065035, "y": 0.7615594762803728, "at": 0.26, "out": {"at": 2.203572046862612, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "But now I won't lose control", "font": "cd", "color": "white", "w": 0.15783414907096316, "h": 0.05, "x": 0.24346538588294137, "y": 0.51133444769329, "at": 0.28, "out": {"at": 1.5076756811538492, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Foot is on the gas", "font": "cd", "color": "white", "w": 0.15241976194277906, "h": 0.05, "x": 0.5397267526464502, "y": 0.33495632502175804, "at": 0.3, "out": {"at": 1.4435199799287282, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "My whole crew", "font": "cd", "color": "white", "w": 0.12268057685261073, "h": 0.05, "x": 0.6945988354569197, "y": 0.33218715188741377, "at": 0.32, "out": {"at": 1.6773112835447581, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "A hell risk", "font": "cd", "color": "white", "w": 0.24012984236110857, "h": 0.1, "x": 0.8727739980606843, "y": 0.08800730503243356, "at": 0.34, "out": {"at": 2.0367818924154664, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "I want money", "font": "cd", "color": "red", "w": 0.10556651014906648, "h": 0.05, "x": 0.43114640808219856, "y": 0.10902236328694621, "at": 0.36, "out": {"at": 2.282497087818787, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Cash", "font": "cd", "color": "white", "w": 0.09341852936031615, "h": 0.05, "x": 0.24221270408409232, "y": 0.923544427781289, "at": 0.38, "out": {"at": 1.7896666566261499, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Want it all", "font": "cd", "color": "white", "w": 0.13880095497803568, "h": 0.05, "x": 0.15383493653358782, "y": 0.4424085677283846, "at": 0.4, "out": {"at": 1.208943482356361, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Selfish", "font": "cd", "color": "red", "w": 0.10531549134999763, "h": 0.05, "x": 0.9393839543011318, "y": 0.8099823503864936, "at": 0.42, "out": {"at": 2.366410597645283, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Never gave", "font": "cd", "color": "red", "w": 0.1288839046131857, "h": 0.05, "x": 0.33957798199025796, "y": 0.3011512668140225, "at": 0.44, "out": {"at": 1.6581131560005633, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "I'm better", "font": "cd", "color": "white", "w": 0.2844110008901174, "h": 0.1, "x": 0.5279416331994382, "y": 0.21786868387258918, "at": 0.46, "out": {"at": 2.3120022989738835, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Cannot help this", "font": "cd", "color": "red", "w": 0.10918620234154919, "h": 0.05, "x": 0.5133574078096201, "y": 0.5423284664995996, "at": 0.48, "out": {"at": 1.7039542936224992, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Caught up in my ways", "font": "cd", "color": "white", "w": 0.13748980921186416, "h": 0.05, "x": 0.6712451395167871, "y": 0.6443362315759085, "at": 0.5, "out": {"at": 2.063494231015285, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Counting days", "font": "cd", "color": "red", "w": 0.12683075448934142, "h": 0.05, "x": 0.7950045867815836, "y": 0.2930754318637979, "at": 0.52, "out": {"at": 2.3733392668309516, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "F×K", "font": "cd", "color": "red", "w": 0.09400733891851615, "h": 0.05, "x": 0.21721146547035514, "y": 0.8096033567949457, "at": 0.54, "out": {"at": 1.6640253839327934, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Brawl", "font": "cd", "color": "red", "w": 0.08736851085941418, "h": 0.05, "x": 0.3141673344275213, "y": 0.5003072292338646, "at": 0.56, "out": {"at": 1.9430933975925768, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Roll up 20", "font": "cd", "color": "red", "w": 0.12440630729912358, "h": 0.05, "x": 0.7092880703882376, "y": 0.7888060280639881, "at": 0.58, "out": {"at": 1.4900632120018193, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Deep low", "font": "cd", "color": "white", "w": 0.12883369568719272, "h": 0.05, "x": 0.9189875257057079, "y": 0.9017344997392485, "at": 0.6, "out": {"at": 1.725395202626299, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Belt is snapped", "font": "cd", "color": "white", "w": 0.09620289186938233, "h": 0.05, "x": 0.8113922186193634, "y": 0.30891521430354196, "at": 0.62, "out": {"at": 1.1103714213338571, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Like", "font": "cd", "color": "red", "w": 0.13803716282265246, "h": 0.05, "x": 0.5711438642030995, "y": 0.645689481676067, "at": 0.64, "out": {"at": 1.589108842788134, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Whoa!", "font": "cd", "color": "red", "w": 0.06276220157414589, "h": 0.05, "x": 0.20082029965575351, "y": 0.4481402056603371, "at": 0.66, "out": {"at": 1.9101638887304055, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Put a hundred down", "font": "cd", "color": "white", "w": 0.07805331455980626, "h": 0.05, "x": 0.6922468533876411, "y": 0.9280921859666349, "at": 0.68, "out": {"at": 2.371663937842396, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Do not", "font": "cd", "color": "white", "w": 0.1467053769690228, "h": 0.1, "x": 0.33926874080168334, "y": 0.2197615476305964, "at": 0.7000000000000001, "out": {"at": 1.2707041425082761, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "On the map", "font": "cd", "color": "white", "w": 0.09510998366795394, "h": 0.05, "x": 0.6430211172877154, "y": 0.12333974807966251, "at": 0.72, "out": {"at": 1.286112755037732, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Y'all ain't even know", "font": "cd", "color": "red", "w": 0.20107514970318466, "h": 0.1, "x": 0.30510470236206166, "y": 0.42083723695898867, "at": 0.74, "out": {"at": 1.1611042139261771, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "The place I had to go", "font": "cd", "color": "red", "w": 0.1149932931464643, "h": 0.05, "x": 0.32521655204477207, "y": 0.3198475724443372, "at": 0.76, "out": {"at": 1.7177067777151065, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "To go", "font": "cd", "color": "red", "w": 0.1418521999785004, "h": 0.05, "x": 0.42880969554285436, "y": 0.7754310680646428, "at": 0.78, "out": {"at": 1.8992151584754877, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Be my soul", "font": "cd", "color": "red", "w": 0.07567754491860988, "h": 0.05, "x": 0.3968168015494647, "y": 0.47978754849990507, "at": 0.8, "out": {"at": 1.278820341491667, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "In my cell", "font": "cd", "color": "white", "w": 0.0951116082230466, "h": 0.05, "x": 0.8462509592045806, "y": 0.06083378088497639, "at": 0.8200000000000001, "out": {"at": 1.1510856751833782, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Lost a part of me", "font": "cd", "color": "white", "w": 0.14764996967560184, "h": 0.05, "x": 0.5565791118945664, "y": 0.43769678398878664, "at": 0.84, "out": {"at": 2.36735260126643, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "But now I won't lose control", "font": "cd", "color": "red", "w": 0.15724546276651213, "h": 0.05, "x": 0.39420686973500657, "y": 0.90580240512169, "at": 0.86, "out": {"at": 2.2792461739677066, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Foot is on the gas", "font": "cd", "color": "red", "w": 0.09008027039193026, "h": 0.05, "x": 0.2809400883736663, "y": 0.07731075794141165, "at": 0.88, "out": {"at": 2.3232464907913437, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "My whole crew", "font": "cd", "color": "red", "w": 0.08863983522600785, "h": 0.05, "x": 0.4797034157881284, "y": 0.167259690916924, "at": 0.9, "out": {"at": 1.870361271092022, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "A hell risk", "font": "cd", "color": "red", "w": 0.06399765057988933, "h": 0.05, "x": 0.1800674033730377, "y": 0.40530218848302135, "at": 0.92, "out": {"at": 1.6724152307628877, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "I want money", "font": "cd", "color": "red", "w": 0.10742780162536147, "h": 0.05, "x": 0.09235138696566932, "y": 0.4913045537141403, "at": 0.9400000000000001, "out": {"at": 2.1814795629432195, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Cash", "font": "cd", "color": "red", "w": 0.12080375909245258, "h": 0.05, "x": 0.4776756541135368, "y": 0.6274914327253684, "at": 0.96, "out": {"at": 1.8453952136108556, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Want it all", "font": "cd", "color": "white", "w": 0.14520646944744847, "h": 0.1, "x": 0.30846575133113685, "y": 0.6830640224798548, "at": 0.98, "out": {"at": 1.859000127133362, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Selfish", "font": "cd", "color": "white", "w": 0.0961039382828485, "h": 0.05, "x": 0.7156151222819194, "y": 0.5799081334217044, "at": 1.0, "out": {"at": 1.0510004788932994, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Never gave", "font": "cd", "color": "red", "w": 0.1285732885573605, "h": 0.05, "x": 0.15468855963191167, "y": 0.6649301636228055, "at": 1.02, "out": {"at": 1.2676510275929027, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "I'm better", "font": "cd", "color": "red", "w": 0.10277315333105033, "h": 0.05, "x": 0.5665647718782367, "y": 0.6831994709288751, "at": 1.04, "out": {"at": 1.8851294838518664, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Cannot help this", "font": "cd", "color": "red", "w": 0.14412003992905703, "h": 0.05, "x": 0.47863335627944614, "y": 0.6604488166397304, "at": 1.06, "out": {"at": 2.0074532171715456, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Caught up in my ways", "font": "cd", "color": "red", "w": 0.1358196726933526, "h": 0.05, "x": 0.3272121162408977, "y": 0.06283928194095863, "at": 1.08, "out": {"at": 2.0905968115176865, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Counting days", "font": "cd", "color": "red", "w": 0.10724496745368511, "h": 0.05, "x": 0.3336365810451066, "y": 0.205595471419417, "at": 1.1, "out": {"at": 1.973325875168543, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "F×K", "font": "cd", "color": "red", "w": 0.11379447650427202, "h": 0.05, "x": 0.4344934639003125, "y": 0.536437480407985, "at": 1.12, "out": {"at": 1.0679757095559466, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "text", "s": "Brawl", "font": "cd", "color": "white", "w": 0.06851961954813487, "h": 0.05, "x": 0.11536747711873971, "y": 0.8891062183863441, "at": 1.1400000000000001, "out": {"at": 1.466272236493513, "fx": "fade", "d": 0.2}, "distress": false, "ls": 0.02, "op": 0.9}, {"k": "chalk", "shape": "tri", "box": {"x": 0.9308173914390365, "y": 0.9485010300929285}, "size": 0.025, "at": 0.3, "d": 0.2, "sw": 3, "until": 2.0414977802636423}, {"k": "chalk", "shape": "xmark", "box": {"x": 0.1610375244755773, "y": 0.16012084184072084}, "size": 0.025, "at": 0.35, "d": 0.2, "sw": 3, "until": 1.9374666063106423}, {"k": "chalk", "shape": "xmark", "box": {"x": 0.691199029276981, "y": 0.17116330038493702}, "size": 0.025, "at": 0.4, "d": 0.2, "sw": 3, "until": 1.5509914908329299}, {"k": "chalk", "shape": "tri", "box": {"x": 0.18475700516087756, "y": 0.5995507453885485}, "size": 0.025, "at": 0.45, "d": 0.2, "sw": 3, "until": 1.6967234981243795}, {"k": "chalk", "shape": "plus", "box": {"x": 0.11050514102104703, "y": 0.241824923747827}, "size": 0.025, "at": 0.5, "d": 0.2, "sw": 3, "until": 1.8666132698197488}, {"k": "chalk", "shape": "next", "box": {"x": 0.3912791503293324, "y": 0.11480354630860223}, "size": 0.025, "at": 0.55, "d": 0.2, "sw": 3, "until": 1.2690734944144189}, {"k": "chalk", "shape": "star", "box": {"x": 0.15651866546350607, "y": 0.40867746092834617}, "size": 0.025, "at": 0.6000000000000001, "d": 0.2, "sw": 3, "until": 1.9484637481063563}, {"k": "chalk", "shape": "xmark", "box": {"x": 0.4385034522585123, "y": 0.33311265794134726}, "size": 0.025, "at": 0.65, "d": 0.2, "sw": 3, "until": 1.9202611549744941}, {"k": "chalk", "shape": "tri", "box": {"x": 0.3680626075318768, "y": 0.6405392589925109}, "size": 0.025, "at": 0.7, "d": 0.2, "sw": 3, "until": 2.297753808400791}, {"k": "chalk", "shape": "plus", "box": {"x": 0.6775666509959982, "y": 0.18599828713970906}, "size": 0.025, "at": 0.75, "d": 0.2, "sw": 3, "until": 1.9576151193196816}, {"k": "chalk", "shape": "star", "box": {"x": 0.31121289893523063, "y": 0.8977738402739299}, "size": 0.025, "at": 0.8, "d": 0.2, "sw": 3, "until": 1.859860366173486}, {"k": "chalk", "shape": "plus", "box": {"x": 0.2869220506911539, "y": 0.5465077691679378}, "size": 0.025, "at": 0.8500000000000001, "d": 0.2, "sw": 3, "until": 1.505028308921527}, {"k": "chalk", "shape": "ring", "box": {"x": 0.5152961349307945, "y": 0.17040276547689687}, "size": 0.025, "at": 0.9000000000000001, "d": 0.2, "sw": 3, "until": 1.4813043760970468}, {"k": "chalk", "shape": "ring", "box": {"x": 0.4580044035842835, "y": 0.40001325727543485}, "size": 0.025, "at": 0.95, "d": 0.2, "sw": 3, "until": 1.3574193720218208}]}, {"name": "s52", "t0": 64.0, "t1": 68.2, "bg": {"paper": true}, "pieces": [{"k": "text", "s": "NodeMotion", "id": "logo", "font": "cd", "color": "red", "w": 0.14, "h": 0.06, "y": 0.55, "in": "slam", "at": 0.2, "until": 2.45, "distress": false}, {"k": "chalk", "shape": "crown", "ref": "logo", "color": "white", "sw": 4, "at": 0.35, "d": 0.3, "up": 0.05, "w": 0.04, "h": 0.035, "cx": 0.4}, {"k": "chalk", "shape": "underline", "ref": "logo", "color": "white", "sw": 4, "at": 0.55, "d": 0.3, "until": 2.45}], "type": "outro"}], "outroDesigns": {"v1": {"name": "outro-v1", "bg": {"clip": "street", "off": 9, "dark": 0.25, "cuts": false, "edges": [{"side": "bottom", "d": 0.1, "j": 0.5}]}, "pieces": [{"k": "text", "s": "Gracias", "id": "ot", "outro": "title", "font": "ex", "color": "red", "w": 0.84, "h": 0.32, "y": 0.42, "in": "slam", "from": 1.5, "at": 0.1, "d": 0.22, "glow": true, "op": 0.94, "ghost": {"color": "red", "dx": 0.03, "op": 0.45, "delay": 0.1}, "out": {"at": -1.55, "fx": "smear", "d": 0.16, "dx": 0.08}}, {"k": "chalk", "shape": "crown", "ref": "ot", "color": "white", "sw": 7, "at": 0.75, "d": 0.3, "up": 0.06, "w": 0.07, "h": 0.06, "cx": 0.08, "erase": {"at": -2.05, "d": 0.22}}, {"k": "chalk", "shape": "underline", "ref": "ot", "color": "white", "sw": 12, "at": 0.85, "d": 0.35, "dy": 1.02, "erase": {"at": -1.85, "d": 0.25}}, {"k": "text", "s": "por ver", "outro": "sub", "font": "cd", "color": "white", "w": 0.5, "h": 0.1, "y": 0.66, "in": "words", "step": 0.12, "at": 0.6, "out": {"at": -2.25, "fx": "smear", "d": 0.14}}, {"k": "text", "s": "Suscríbete · NodeMotion", "outro": "feats", "font": "th", "color": "white", "w": 0.5, "h": 0.05, "y": 0.8, "ls": 0.2, "in": "spread", "ls0": 0.6, "d": 0.35, "at": 1.1, "fw": 400, "out": {"at": -2.45, "fx": "fade", "d": 0.15}}, {"k": "glitch", "at": 1.7, "d": 0.2, "n": 5, "redP": 0.5}, {"k": "glitch", "at": -1.62, "d": 0.14, "n": 4, "redP": 0.6}]}, "v2": {"name": "outro-v2", "bg": {"paper": true}, "pieces": [{"k": "text", "s": "Gracias", "id": "ot", "outro": "title", "font": "cd", "color": "red", "w": 0.32, "h": 0.12, "y": 0.5, "in": "slam", "at": 0.25, "d": 0.2, "distress": false, "out": {"at": -1.4, "fx": "smear", "d": 0.12, "dx": 0.03}}, {"k": "chalk", "shape": "crown", "ref": "ot", "color": "white", "sw": 6, "at": 0.45, "d": 0.3, "up": 0.07, "w": 0.06, "h": 0.05, "cx": 0.45, "erase": {"at": -2.3, "d": 0.3, "step": 0.08}}, {"k": "chalk", "shape": "underline", "ref": "ot", "color": "white", "sw": 8, "at": 0.65, "d": 0.3, "erase": {"at": -1.95, "d": 0.28}}, {"k": "text", "s": "por ver", "outro": "sub", "font": "th", "color": "ink", "w": 0.28, "h": 0.06, "y": 0.64, "ls": 0.2, "in": "spread", "ls0": 0.6, "d": 0.35, "at": 0.9, "fw": 500, "distress": false, "out": {"at": -2.6, "fx": "fade", "d": 0.15}}, {"k": "text", "s": "Suscríbete · NodeMotion", "outro": "feats", "font": "cd", "color": "ink", "w": 0.32, "h": 0.035, "y": 0.72, "ls": 0.12, "in": "fade", "d": 0.3, "at": 1.2, "op": 0.8, "distress": false, "out": {"at": -2.8, "fx": "fade", "d": 0.15}}, {"k": "glitch", "at": -1.48, "d": 0.1, "n": 3, "redP": 0.3}]}}, "bgCuts": [0.2, 1.28, 1.48, 2.12, 3.08, 4.64, 5.08, 6.2, 6.32, 7.44, 7.52, 7.84, 9.64, 10.12, 10.6, 10.72, 11.04, 11.16, 11.24, 11.32, 11.44, 11.52, 13.76, 13.96, 14.4, 14.8, 16.28, 16.52, 16.64, 16.8, 16.92, 20.04, 20.8, 24.56, 24.92, 25.04, 25.28, 25.44, 25.56, 25.64, 25.72, 26.04, 26.68, 28.04, 28.28, 29.24, 29.64, 29.8, 30.0, 30.84, 31.48, 31.84, 32.24, 32.56, 33.12, 33.68, 33.96, 34.08, 34.84, 35.2, 35.48, 35.56, 36.56, 37.16, 37.56, 40.04, 41.24, 41.4, 41.52, 41.64, 41.8, 42.16, 42.44, 42.52, 42.72, 43.12, 43.48, 43.6, 43.68, 44.12, 44.88, 45.16, 48.68, 48.76, 49.68, 49.88, 50.36, 51.56, 53.6, 53.88, 54.36, 55.48, 55.6, 55.92, 56.0, 56.2, 56.6, 57.28, 57.52, 58.04, 58.44, 58.8, 59.44, 60.4, 61.48, 61.72, 62.04, 62.4, 62.6, 64.0, 67.4]}]};
const FONT_LOADS = ["100px Anton", "900 100px Archivo", "300 100px Oswald", "900 100px Archivo", "400 100px Anton"];

/* ======================= NÚCLEO COMÚN (promo-*) =========================
   Compartido por las 6 plantillas de commercial/ (promo-trendy,
   promo-dynamic, promo-urban, promo-sports, promo-editorial y
   promo-kinetic). Contrato:
   · config.json  = colección { activeId, configs: [ CASO ] } (como neon /
     caution): audio, lyricsUrl, paleta, fuentes, MEDIA (videos / imágenes)
     y la coreografía `scenes` (tipo de escena + media por escena).
   · lyricsUrl   = guion en formato Whisper { segments: [ { start, end, text,
     words: [ { word, start, end } ] } ] }. UN segmento = UNA escena (corte en
     segment.start, palabras que aparecen en word.start). Campos extra
     opcionales por segmento: "lines" (cómo partir el texto en renglones) y
     "sub" (texto chico de acompañamiento). Una transcripción real de Whisper
     también sirve tal cual.
   · Todo se anima con Tracks propios (interpolan y escriben style solo si
     cambia; sin Web Animations → nada se promueve a capa y el headless no se
     hunde) posicionados con el reloj del audio: ?t=SEG congela un cuadro y
     los videos se buscan a ese instante exacto.
   Servir por HTTP (python3 -m http.server): por file:// el fetch se bloquea. */
const doc = document, $ = id => doc.getElementById(id);
const QS = new URLSearchParams(location.search);
const FROZEN = QS.has("t") ? parseFloat(QS.get("t")) : null;

async function loadDB() {
  for (const u of ["config.json", `assets/${NAME}.config.json`, "assets/config.json"]) {
    try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {}
  }
  console.warn(`[${NAME}] config.json no disponible — usando DEFAULT_CONFIG embebido`);
  return DEFAULT_CONFIG;
}
/* merge profundo de objetos; los arrays (media, scenes…) se reemplazan enteros */
function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== "object" || b === null) return b === undefined ? a : b;
  const out = { ...(typeof a === "object" && a && !Array.isArray(a) ? a : {}) };
  for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
  return out;
}
const DB = await loadDB();
const RAW = DB.configs.find(c => c.id === ACTIVE_ID) || DB.configs.find(c => c.id === DB.activeId) || DB.configs[0];
const C = deepMerge(DEFAULT_CONFIG.configs[0], RAW);
const DEBUG = C.debug?.enabled || QS.get("debug") === "1";
if (C.fonts?.googleUrl) {
  const link = doc.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
  if (link && link.href !== C.fonts.googleUrl) link.href = C.fonts.googleUrl;
}
for (const [k, v] of Object.entries(C.palette || {})) doc.documentElement.style.setProperty("--" + k, v);

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EASE_OUT = "cubic-bezier(.16,.84,.24,1)", EASE_IN = "cubic-bezier(.6,0,.9,.4)", EASE_IO = "cubic-bezier(.65,0,.3,1)";
const EASE_BACK = "cubic-bezier(.3,1.5,.5,1)";

/* ---------------- Tracks: interpolación propia, seek determinista ---------------- */
const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
function lerpStr(a, b, p) {
  if (p <= 0 || a === b) return a;
  if (p >= 1) return b;
  const na = a.match(NUM), nb = b.match(NUM);
  if (!na || !nb || na.length !== nb.length) return p < 0.5 ? a : b;
  let i = 0;
  return b.replace(NUM, () => { const v = +na[i] + (+nb[i] - +na[i]) * p; i++; return String(Math.round(v * 1000) / 1000); });
}
const easeCache = new Map();
function easeFn(spec) {
  let f = easeCache.get(spec);
  if (f) return f;
  const m = /cubic-bezier\(([^)]+)\)/.exec(spec);
  if (!m) f = spec.startsWith("steps") ? () => 0 : p => p;
  else {
    const [x1, y1, x2, y2] = m[1].split(",").map(Number);
    const bz = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    const dbz = (t, a, b) => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
    f = x => {
      let t = x;
      for (let i = 0; i < 6; i++) { const d = dbz(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (bz(t, x1, x2) - x) / d; t = clamp(t, 0, 1); }
      return bz(t, y1, y2);
    };
  }
  easeCache.set(spec, f);
  return f;
}
class Track {
  constructor(el, prop, init, discrete = false) { this.el = el; this.prop = prop; this.discrete = discrete; this.keys = [[0, init, "linear"]]; }
  get last() { return this.keys[this.keys.length - 1][1]; }
  set(t, v) { this.keys.push([t, v, "linear"]); return this; }
  to(t0, d, v, ease = "linear") { this.keys.push([t0, this.last, ease]); this.keys.push([t0 + Math.max(0.001, d), v, "linear"]); return this; }
  compile() {
    this.ks = this.keys.slice().sort((a, b) => a[0] - b[0]).map(([t, v, e]) => [t, v, easeFn(this.discrete ? "steps" : e)]);
    this.a = Infinity; this.b = -Infinity;
    for (let i = 1; i < this.ks.length; i++)
      if (this.ks[i][1] !== this.ks[i - 1][1]) { this.a = Math.min(this.a, this.ks[i - 1][0]); this.b = Math.max(this.b, this.ks[i][0]); }
    this.side = null; this.cur = undefined;
  }
  value(t) {
    const ks = this.ks;
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = ks.length - 1; i >= 0; i--) {
      if (t < ks[i][0]) continue;
      const nx = ks[i + 1];
      if (!nx) return ks[i][1];
      const span = nx[0] - ks[i][0];
      return span <= 0 ? nx[1] : lerpStr(ks[i][1], nx[1], ks[i][2]((t - ks[i][0]) / span));
    }
    return ks[0][1];
  }
  seek(t) {
    const side = t < this.a ? -1 : t > this.b ? 1 : 0;
    if (side !== 0 && side === this.side) return;
    this.side = side;
    const v = this.value(t);
    if (v !== this.cur) {
      if (this.prop[0] === "@") this.el[this.prop.slice(1)] = v;   /* "@textContent" → propiedad directa */
      else this.el.style[this.prop] = v;
      this.cur = v;
    }
  }
}

/* ---------------- DOM, texto, medición ---------------- */
function div(parent, cls, css) {
  const d = doc.createElement("div");
  if (cls) d.className = cls;
  if (css) Object.assign(d.style, css);
  if (parent) parent.appendChild(d);
  return d;
}
const meas = (() => { const m = doc.createElement("span"); m.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;font-size:100px;line-height:1"; doc.body.appendChild(m); return m; })();
const measCache = new Map();
function measure(text, cls, ls = 0) {
  const key = cls + "|" + ls + "|" + text;
  let m = measCache.get(key);
  if (!m) {
    meas.className = "tx " + cls; meas.style.letterSpacing = ls + "em"; meas.textContent = text;
    const r = meas.getBoundingClientRect();
    m = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    measCache.set(key, m);
  }
  return m;
}
const fit = (text, cls, ls, maxW, maxH) => { const m = measure(text, cls, ls); return 100 * Math.min(maxW / m.w, maxH / m.h); };
const textW = (text, cls, ls, fs) => measure(text, cls, ls).w * fs / 100;
/* texto decorativo enorme → <canvas> rasterizado UNA vez (mover un texto de
   1000+ px re-rasteriza cada cuadro en headless: 27 → 7 fps). Respeta fuente,
   peso, itálica, font-stretch, mayúsculas, espaciado, contorno y textura. */
const STRETCH = { "50%": "ultra-condensed", "62.5%": "extra-condensed", "75%": "condensed", "87.5%": "semi-condensed", "112.5%": "semi-expanded", "125%": "expanded", "150%": "extra-expanded", "200%": "ultra-expanded" };
function canvasText(text, o) {
  meas.className = "tx " + (o.cls || ""); meas.style.letterSpacing = "0em";
  const cs = getComputedStyle(meas), fs = o.fs;
  const t = cs.textTransform === "uppercase" ? text.toUpperCase() : text;
  const cv = doc.createElement("canvas"), cx = cv.getContext("2d");
  const setFont = () => {
    cx.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    cx.fontStretch = STRETCH[cs.fontStretch] || "normal";
    cx.letterSpacing = `${(o.ls || 0) * fs}px`;
  };
  setFont();
  const sw = o.stroke ? (o.swPx ?? Math.max(1, fs * (o.sw || 0.012))) : 0;
  const padL = fs * 0.06 + sw, padR = fs * 0.22 + sw;
  const w = Math.ceil(cx.measureText(t).width + padL + padR), h = Math.ceil(fs * 1.3);
  cv.width = Math.min(16000, w); cv.height = h;
  setFont();
  cx.textBaseline = "middle";
  const y = h / 2 + fs * 0.04;
  if (o.stroke) { cx.lineWidth = sw; cx.strokeStyle = o.color; cx.lineJoin = "round"; cx.strokeText(t, padL, y); }
  else { cx.fillStyle = o.color; cx.fillText(t, padL, y); }
  if (o.texture) {            /* textura de piedra: motas oscuras solo sobre la letra */
    cx.globalCompositeOperation = "source-atop";
    const n = Math.floor(cv.width * cv.height / 220);
    for (let i = 0; i < n; i++) { cx.fillStyle = `rgba(0,0,0,${0.08 + texRng() * 0.3})`; const s = 1 + texRng() * 3; cx.fillRect(texRng() * cv.width, texRng() * cv.height, s, s); }
    cx.globalCompositeOperation = "source-over";
  }
  cv.className = "tx"; cv.style.width = cv.width + "px"; cv.style.height = h + "px"; cv.style.display = "block";
  return cv;
}
/* texto posicionado: (x, y) = punto de ancla (ax, ay ∈ 0..1). .bx posiciona, .tx se anima */
function tx(parent, text, o) {
  const box = div(parent, "bx");
  box.style.left = o.x + "px"; box.style.top = o.y + "px";
  box.style.transform = `translate(${-(o.ax ?? 0.5) * 100}%, ${-(o.ay ?? 0.5) * 100}%)` + (o.rot ? ` rotate(${o.rot}deg)` : "");
  if (o.canvas) { const el = canvasText(text, o); box.appendChild(el); return { box, el, chars: [], words: [] }; }
  const el = div(box, "tx " + (o.cls || ""));
  el.style.fontSize = o.fs + "px";
  if (o.ls) el.style.letterSpacing = o.ls + "em";
  if (o.stroke) { el.style.color = "transparent"; el.style.webkitTextStroke = `${Math.max(1, o.fs * (o.sw || 0.012))}px ${o.color}`; }
  else el.style.color = o.color;
  const chars = [], words = [];
  if (o.split === "chars") {
    let wi = 0;
    for (const c of text) {
      const s = doc.createElement("span"); s.className = "ch"; s.textContent = c; s.wi = wi;
      if (c === " ") wi++;
      el.appendChild(s); chars.push(s);
    }
  } else if (o.split === "words") {
    text.split(" ").forEach((w, i) => {
      if (i) el.appendChild(doc.createTextNode(" "));
      const s = doc.createElement("span"); s.className = "wd"; s.textContent = w; el.appendChild(s); words.push(s);
    });
  } else el.textContent = text;
  return { box, el, chars, words };
}

/* ---------------- filtros SVG: duotono, B/N, desenfoque direccional ---------------- */
const SVGNS = "http://www.w3.org/2000/svg";
const fx = (() => {
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.style.position = "absolute";
  const d = doc.createElementNS(SVGNS, "defs"); s.appendChild(d); doc.body.appendChild(s);
  return d;
})();
const hex = h => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
/* duotono: luminancia → tabla [oscuro → claro], con contraste previo */
function duoFilter(id, dark, light, contrast = 1.25) {
  const [dr, dg, db] = hex(dark), [lr, lg, lb] = hex(light);
  const icpt = (1 - contrast) / 2;
  fx.insertAdjacentHTML("beforeend", `<filter id="${id}" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncR type="linear" slope="${contrast}" intercept="${icpt}"/><feFuncG type="linear" slope="${contrast}" intercept="${icpt}"/><feFuncB type="linear" slope="${contrast}" intercept="${icpt}"/></feComponentTransfer>
    <feComponentTransfer><feFuncR type="table" tableValues="${dr} ${lr}"/><feFuncG type="table" tableValues="${dg} ${lg}"/><feFuncB type="table" tableValues="${db} ${lb}"/></feComponentTransfer>
  </filter>`);
  return `url(#${id})`;
}
for (const [n, s] of [[1, 6], [2, 16], [3, 34]]) {
  fx.insertAdjacentHTML("beforeend", `<filter id="mbx${n}" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="${s} 0"/></filter>`);
  fx.insertAdjacentHTML("beforeend", `<filter id="mby${n}" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="0 ${s}"/></filter>`);
}
/* gradings del config (C.grades): key → filtro CSS/SVG. Si un media trae la
   variante ya gradada (media.graded[key], generada por tools/grade_media.py)
   se usa esa y NO se aplica filtro en vivo: filtrar video en tiempo real es
   carísimo en Chrome headless (45 fps → 13 fps con un solo filtro). */
const GRADE = {};
for (const [k, g] of Object.entries(C.grades || {}))
  GRADE[k] = g.type === "duo" ? duoFilter(k, g.dark, g.light, g.contrast ?? 1.25)
           : `saturate(${g.saturate ?? 1}) contrast(${g.contrast ?? 1}) brightness(${g.brightness ?? 1})`;
/* video → foto fija (su póster), conservando las variantes gradadas del póster */
function asStill(s) {
  if (!s || s.type !== "video") return s;
  const graded = {};
  for (const [k, g] of Object.entries(s.graded || {})) if (g.poster) graded[k] = { src: g.poster };
  return { ...s, type: "image", src: s.poster || s.src, graded };
}
function blurPass(tr, t0, d, axis = "x", fadeIn = false) {
  const f = n => `url(#mb${axis}${n})`;
  if (fadeIn) tr.set(t0, "none").set(t0 + d * 0.35, f(1)).set(t0 + d * 0.65, f(2)).set(t0 + d, f(3));
  else tr.set(t0, f(3)).set(t0 + d * 0.4, f(2)).set(t0 + d * 0.75, f(1)).set(t0 + d, "none");
}

/* ---------------- texturas (grano) ---------------- */
const texRng = mulberry32((C.seed || 7) * 31 + 5);
function noiseTile(size, alpha) {
  const cv = doc.createElement("canvas"); cv.width = cv.height = size;
  const cx = cv.getContext("2d"), im = cx.createImageData(size, size), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const v = texRng() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = texRng() * alpha; }
  cx.putImageData(im, 0, 0);
  return `url(${cv.toDataURL()})`;
}
const GRAIN = noiseTile(192, 255);

/* ---------------- guion (lyrics.json) → escenas ---------------- */
async function loadScript() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    /* filtro de alucinaciones de Whisper (tramos instrumentales): config.lyricsFilter
       = { minLogprob, drop: [regex…] } — un segmento que no pasa se descarta */
    const F = C.lyricsFilter || {}, drop = (F.drop || []).map(x => new RegExp(x, "i"));
    const bad = s => (F.minLogprob != null && s.avg_logprob != null && s.avg_logprob < F.minLogprob) ||
                     drop.some(re => re.test(s.text || ""));
    const out = (j.segments || []).filter(s => !bad(s)).map(s => {
      let words = (s.words || []).map(w => ({ text: String(w.word).trim(), t: w.start, end: w.end })).filter(w => w.text);
      if (!words.length && s.text) words = s.text.trim().split(/\s+/).map(x => ({ text: x, t: s.start, end: s.end }));
      return { start: s.start, end: s.end, text: (s.text || "").trim(), lines: s.lines, sub: s.sub, words };
    }).filter(s => isFinite(s.start)).sort((a, b) => a.start - b.start);
    /* Audio puede tardar en entregar loadedmetadata; usa la duración ya anotada en lyrics.json. */
    out.audioDurationSec = Number(j.metadata?.audio_duration_sec) || 0;
    return out;
  } catch (e) {
    console.warn(`[${NAME}] No se pudo cargar`, C.lyricsUrl, e);
    return [];
  }
}
/* renglones de la escena: seg.lines (strings) si existe; si no, un renglón */
function linesOf(sc) {
  const ws = sc.words;
  const specs = Array.isArray(sc.seg.lines) && sc.seg.lines.length ? sc.seg.lines : [ws.map(w => w.text).join(" ")];
  let k = 0;
  return specs.map(str => {
    const n = String(str).trim().split(/\s+/).filter(Boolean).length;
    const lw = ws.slice(k, k + n); k += n;
    return { text: String(str).trim(), words: lw, rt: lw.length ? lw[0].rt : (ws[ws.length - 1]?.rt ?? 0) };
  });
}
function buildTimeline(segs, dur) {
  const slots = C.scenes && C.scenes.length ? C.scenes : [{ type: Object.keys(B)[0] }];
  return segs.map((s, i) => {
    const t0 = i === 0 ? 0 : s.start;
    const t1 = i + 1 < segs.length ? segs[i + 1].start : dur;
    const slot = slots[i % slots.length];
    const type = B[slot.type] ? slot.type : Object.keys(B)[0];
    return { idx: i, t0, t1, dur: Math.max(0.05, t1 - t0), seg: s, slot, type,
             words: s.words.map(w => ({ text: w.text, rt: Math.max(0, w.t - t0) })) };
  });
}

/* ---------------- letra de canción → frases ---------------- */
/* segmentos de Whisper → frases de ≤ maxWords / ≤ maxSec, cortando en la pausa
   más larga; palabras limpias de puntuación, con su tiempo real */
const cleanWord = s => String(s).trim().replace(/[.,;:!?¡¿"“”()\[\]]/g, "").replace(/[`´’]/g, "'");
function lyricPhrases(segs, o = {}) {
  const maxW = o.maxWords ?? 6, maxS = o.maxSec ?? 3.2, minW = o.minWords ?? 2;
  const out = [], q = segs.map(s => {
    const ws = [];
    for (const w of s.words) {
      const x = { text: cleanWord(w.text), t: w.t, end: w.end ?? w.t + 0.3 };
      if (!x.text) continue;
      /* Whisper a veces parte "y'all" → "y" + "'all": se vuelve a unir */
      if (x.text.startsWith("'") && ws.length) { ws[ws.length - 1].text += x.text; ws[ws.length - 1].end = x.end; continue; }
      ws.push(x);
    }
    return ws;
  });
  const dur = ws => ws[ws.length - 1].end - ws[0].t;
  while (q.length) {
    const ws = q.shift();
    if (!ws.length) continue;
    if (ws.length > maxW || (dur(ws) > maxS && ws.length >= 2 * minW)) {
      let bi = Math.ceil(ws.length / 2), bg = -1;
      for (let i = Math.max(minW, Math.ceil(ws.length * 0.2)); i <= Math.min(ws.length - minW, Math.floor(ws.length * 0.8)); i++) {
        const g = ws[i].t - ws[i - 1].end + (/^(and|but|i|i'm|y|pero|que)$/i.test(ws[i].text) ? 0.12 : 0);
        if (g > bg) { bg = g; bi = i; }
      }
      q.unshift(ws.slice(0, bi), ws.slice(bi));
      continue;
    }
    out.push(ws);
  }
  return out;
}
const isStop = w => /^(a|an|the|and|or|but|so|of|to|in|on|at|for|with|i|i'm|me|my|you|your|it|is|am|are|be|we|us|el|la|los|las|un|una|y|o|de|del|en|con|por|que|me|te|mi|tu|su|yo|es)$/i.test(w.text);
/* fuerza de una palabra (para elegir la protagonista de la frase) */
const heroIdx = ws => { let b = 0, bs = -1; ws.forEach((w, i) => { const s = (isStop(w) ? 0 : 10) + w.text.length; if (s > bs) { bs = s; b = i; } }); return b; };

/* línea de tiempo para plantillas de LETRA: una escena por frase, con la
   escena elegida por un mazo ponderado (config.layouts = { tipo: { weight,
   bgs } } + FITS[tipo](frase) de la plantilla), ecos de las palabras fuertes
   en los tramos instrumentales largos y tarjetas de intro / cierre.
   config.timing = { leadSec, holdSec, gapSec, echoSec, cooldown } */
function lyricTimeline(segs, dur, FITS) {
  const Tm = { leadSec: 0.12, holdSec: 0.9, gapSec: 2.4, echoSec: 1.1, cooldown: 3, ...(C.timing || {}) };
  const r = mulberry32((C.seed || 7) * 977 + 3);
  const ph = lyricPhrases(segs, C.phrases || {});
  const list = [];
  const mk = (kind, t0, t1, ws, extra = {}) => ({ kind, t0, t1, seg: { text: ws.map(w => w.text).join(" ") },
    words: ws.map(w => ({ text: w.text, rt: Math.max(0, (w.t ?? t0) - Tm.leadSec - t0) })), ...extra });
  const syn = (texts, t0) => texts.filter(Boolean).map((x, i) => ({ text: x, t: t0 + 0.25 + i * 0.45 + Tm.leadSec }));
  const I = C.intro || {}, O = C.outro || {};
  const first = ph.length ? Math.max(0, ph[0][0].t - Tm.leadSec) : dur;
  const introTitle = window.NexaTemplateIntro?.title?.(I) || I.title || I.artist;
  const introMin = window.NexaTemplateIntro?.minDuration?.() ?? 1.2;
  if (first >= introMin && introTitle) list.push(mk("intro", 0, first, window.NexaTemplateIntro?.words ? window.NexaTemplateIntro.words(introTitle, 0, Tm.leadSec) : syn([introTitle], 0), { type: I.type || "intro" }));
  const heroes = [], hist = [];
  ph.forEach((ws, i) => {
    const t0 = i === 0 && !list.length ? 0 : Math.max(0, ws[0].t - Tm.leadSec);
    const nx = ph[i + 1], lastEnd = ws[ws.length - 1].end;
    let t1 = nx ? Math.max(t0 + 0.35, nx[0].t - Tm.leadSec) : dur;
    heroes.push(ws[heroIdx(ws)].text); hist.push(ws);
    let gap = null;
    if (t1 - lastEnd > Tm.gapSec) { gap = [lastEnd + Tm.holdSec, t1]; t1 = gap[0]; }
    const ly = mk("lyric", t0, t1, ws);
    list.push(ly);
    const minOutroTail = Number.isFinite(Number(O.minTailSec)) ? Math.max(0, Number(O.minTailSec)) : 1.2;
    const outroBuffer = Number.isFinite(Number(O.tailBufferSec)) ? Math.max(0, Number(O.tailBufferSec)) : 0.3;
    if (!gap && !nx && O.enabled !== false && (O.title || O.sub) && dur - lastEnd > minOutroTail)
      gap = [Math.max(t0 + 0.6, lastEnd + outroBuffer), dur];
    if (!gap) return;
    ly.t1 = gap[0];
    /* tramo final: el cierre ocupa los últimos outro.sec segundos; antes, ecos */
    if (!nx && O.enabled !== false && (O.title || O.sub)) {
      const os = Math.max(gap[0], dur - (O.sec ?? 3.2));
      list.push(mk("outro", os, dur, syn([O.title, O.sub, O.feats], os), { type: O.type || "outro" }));
      if (os - gap[0] < 0.8) { ly.t1 = os; return; }
      gap = [gap[0], os];
    }
    /* tramo instrumental largo → se repiten frases completas ya cantadas (en orden,
       como un estribillo); corto → ecos de las palabras fuertes */
    const len = gap[1] - gap[0], ps = Tm.echoPhraseSec ?? 1.8;
    if (len >= 3 * ps && hist.length) {
      const k = Math.max(1, Math.round(len / ps));
      for (let j = 0; j < k; j++) {
        const a = gap[0] + len * j / k, b = gap[0] + len * (j + 1) / k, src = hist[j % hist.length];
        const step = Math.min(0.26, (b - a) * 0.55 / Math.max(1, src.length));
        list.push(mk("echo", a, b, src.map((w, n) => ({ text: w.text, t: a + Tm.leadSec + 0.06 + n * step }))));
      }
    } else {
      const k = Math.max(1, Math.round(len / Tm.echoSec));
      for (let j = 0; j < k; j++) {
        const a = gap[0] + len * j / k, b = gap[0] + len * (j + 1) / k;
        const pool = [...new Set(heroes.slice(-8))];
        const txt = pool[Math.floor(r() * pool.length)] || ws[0].text;
        list.push(mk("echo", a, b, [{ text: txt, t: a + Tm.leadSec + 0.05 }]));
      }
    }
  });
  list.sort((a, b) => a.t0 - b.t0);
  /* mazo: tipo de escena + fondo */
  const L = C.layouts || {}, recent = [];
  let prevBg = "";
  list.forEach((sc, i) => {
    sc.idx = i; sc.dur = Math.max(0.05, sc.t1 - sc.t0);
    if (!sc.type) {
      let c = Object.entries(L).filter(([k, v]) => v.weight > 0 && B[k] && (!FITS[k] || FITS[k](sc)) && !recent.includes(k));
      if (!c.length) c = Object.entries(L).filter(([k, v]) => v.weight > 0 && B[k]);
      let x = r() * c.reduce((a, [, v]) => a + v.weight, 0); sc.type = c[0][0];
      for (const [k, v] of c) { x -= v.weight; if (x <= 0) { sc.type = k; break; } }
      recent.push(sc.type); if (recent.length > Tm.cooldown) recent.shift();
    }
    const bgs = (L[sc.type]?.bgs || C.defaultBgs || ["media"]).filter(b => b !== prevBg || (L[sc.type]?.bgs || []).length === 1);
    const bg = bgs[Math.floor(r() * bgs.length)] || "media";
    /* layouts[tipo].media = [ids] → la escena prefiere esos clips; si no, cualquiera */
    const pool = (L[sc.type]?.media || []).filter(id => (C.media || []).some(m => m.id === id));
    const ids = pool.length ? pool : (C.media || []).map(m => m.id);
    const pk = () => ids[Math.floor(r() * ids.length)];
    const media = ids.length ? [pk(), pk()] : [];
    if (media.length > 1 && media[1] === media[0] && ids.length > 1) media[1] = ids[(ids.indexOf(media[0]) + 1) % ids.length];
    sc.slot = { type: sc.type, bg, media, trans: L[sc.type]?.trans };
    prevBg = bg;
  });
  return list;
}

/* ---------------- transiciones de entrada (sobre la escena anterior) ----------------
   enterFx(X, kind, d): anima la raíz de la escena nueva durante d segundos.
   Con overlapSec > 0 la anterior se ve debajo → disolvencias reales.
   kinds: fade · blur · iris · irisOut · wipeL · wipeR · wipeUp · wipeDown · bars
   (persiana) · rain (franjas verticales irregulares) · burn (borde de quemado
   con brillo) · ink (mancha orgánica) · flash · zoomIn · zoomOut · slice (glitch) */
function enterFx(X, kind, d, o = {}) {
  const { root: R, W, H, r } = X;
  if (!kind || kind === "cut" || X.sc.idx === 0) return;
  const E = EASE_IO;
  const poly = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
  switch (kind) {
    case "fade": X.T(R, "opacity", "0").to(0, d, "1", E); break;
    case "blur":
      X.T(R, "opacity", "0").to(0, d, "1", E);
      X.T(R, "filter", "blur(18px) brightness(1.4)").to(0, d, "blur(0px) brightness(1)", EASE_OUT); break;
    case "iris": { const cx = (o.cx ?? 0.5) * 100, cy = (o.cy ?? 0.5) * 100;
      X.T(R, "clipPath", `circle(0% at ${cx}% ${cy}%)`).to(0, d, `circle(120% at ${cx}% ${cy}%)`, E); break; }
    case "wipeL": X.T(R, "clipPath", "inset(0% 100% 0% 0%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "wipeR": X.T(R, "clipPath", "inset(0% 0% 0% 100%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "wipeUp": X.T(R, "clipPath", "inset(100% 0% 0% 0%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "wipeDown": X.T(R, "clipPath", "inset(0% 0% 100% 0%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "bars": { /* persiana horizontal: n franjas que se abren escalonadas */
      const n = o.n ?? 8, k = 12, mk = p => { const pts = [];
        for (let i = 0; i < n; i++) { const y0 = i * H / n, hh = (H / n) * clamp(p * 1.6 - i / n * 0.6, 0, 1);
          pts.push([0, y0], [W, y0], [W, y0 + hh], [0, y0 + hh], [0, y0]); }
        return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k)); break; }
    case "rain": { /* franjas verticales de ancho irregular que "caen" */
      const n = o.n ?? 44, ws = Array.from({ length: n }, () => 0.3 + r()), sum = ws.reduce((a, b) => a + b, 0), dl = ws.map(() => r() * 0.5);
      X.T(R, "opacity", "0.2").to(0, d, "1", EASE_OUT);
      const k = 12, mk = p => { const pts = []; let x = 0;
        ws.forEach((w, i) => { const ww = w / sum * W, hh = H * clamp((p - dl[i]) / 0.55, 0, 1);
          pts.push([x, 0], [x + ww + 1, 0], [x + ww + 1, hh], [x, hh], [x, 0]); x += ww; });
        return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k));
      tr.set(d + 0.001, "none"); break; }
    case "burn": { /* borde de quemado irregular que avanza + resplandor */
      const k = 14, n = 26, jit = Array.from({ length: n + 1 }, () => r());
      const mk = p => { const pts = [[0, 0]];
        for (let i = 0; i <= n; i++) { const y = i / n * H; pts.push([clamp((p * 1.25 - 0.12) * W + (jit[i] - 0.5) * 0.12 * W, 0, W), y]); }
        pts.push([0, H]); return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k));
      tr.set(d + 0.001, "none");
      /* franja incandescente angosta que viaja pegada al borde quemado */
      const gw = 0.09 * W, glow = div(X.root, "patch", { left: -gw / 2 + "px", top: 0, width: gw + "px", height: H + "px", zIndex: 40, mixBlendMode: "screen", filter: "blur(6px)",
        background: `linear-gradient(90deg, transparent 0%, ${o.color || C.transition?.burnColor || "rgba(255,140,40,0.85)"} 42%, rgba(255,235,190,0.95) 50%, transparent 62%)` });
      const gt = X.T(glow, "transform", "translateX(0px)");
      for (let j = 0; j <= k; j++) gt.set(d * j / k, `translateX(${((j / k * 1.25 - 0.12) * W).toFixed(1)}px)`);
      X.T(glow, "opacity", "1").to(d * 0.85, d * 0.15, "0"); break; }
    case "ink": { /* mancha orgánica que crece desde un punto */
      const cx = (o.cx ?? 0.3 + r() * 0.4) * W, cy = (o.cy ?? 0.35 + r() * 0.3) * H, n = 40, a0 = r() * 6, k = 12;
      const amp = Array.from({ length: n }, (_, i) => 0.75 + 0.25 * Math.sin(i * 1.7 + a0) + (r() - 0.5) * 0.25);
      const mk = p => { const R0 = p * 1.25 * Math.hypot(W, H); return poly(amp.map((a, i) => { const th = i / n * Math.PI * 2; return [cx + Math.cos(th) * R0 * a, cy + Math.sin(th) * R0 * a]; })); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(easeFn(EASE_IN)(j / k)));
      tr.set(d + 0.001, "none"); break; }
    case "flash": {
      const f = div(X.root, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: o.color || C.transition?.flashColor || "#fff", zIndex: 40 });
      X.T(f, "opacity", "0.95").to(0, d, "0", EASE_OUT); break; }
    case "zoomIn":
      X.T(R, "opacity", "0").to(0, d * 0.6, "1", E);
      X.T(R, "transform", "scale(1.35)").to(0, d, "scale(1)", EASE_OUT); break;
    case "zoomOut":
      X.T(R, "opacity", "0").to(0, d * 0.6, "1", E);
      X.T(R, "transform", "scale(0.82)").to(0, d, "scale(1)", EASE_OUT); break;
    case "slice": { /* glitch: franjas horizontales desplazadas que se alinean */
      const n = 7, k = 8, off = Array.from({ length: n }, () => (r() - 0.5) * 0.4 * W);
      const mk = p => { const pts = [];
        for (let i = 0; i < n; i++) { const y0 = i * H / n, y1 = y0 + H / n, dx = off[i] * (1 - p); pts.push([dx, y0], [W + dx, y0], [W + dx, y1], [dx, y1], [dx, y0]); }
        return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k));
      tr.set(d + 0.001, "none"); break; }
  }
}
/* tipo de transición de la escena: slot.trans o sorteo ponderado de config.transition.weights */
function pickTrans(X) {
  if (X.sc.slot.trans) return X.sc.slot.trans;
  const w = Object.entries(C.transition?.weights || { fade: 1 }).filter(([, v]) => v > 0);
  let x = X.r() * w.reduce((a, [, v]) => a + v, 0);
  for (const [k, v] of w) { x -= v; if (x <= 0) return k; }
  return w[0][0];
}

/* ---------------- media (video / imagen) ---------------- */
/* En la captura cuadro a cuadro los medios se bajan como blob porque el
   servidor del grabador no admite Range. En la vista previa normal el navegador
   transmite solo el clip activo y usa su poster mientras carga, sin bloquear el
   resto de la página con variantes que aún no se muestran. config.preload=false
   también permite desactivar la precarga durante captura. */
const BLOBS = new Map();
async function preloadMedia(timeoutMs = 8000) {
  if (C.preload === false || window.__HF_RENDER_CAPTURE_MODE !== true) return;
  const srcs = new Set([C.audio?.src].filter(Boolean));
  for (const m of C.media || []) if (m.type === "video") {
    srcs.add(m.src);
    for (const g of Object.values(m.graded || {})) if (g.src) srcs.add(g.src);
  }
  const jobs = [...srcs].map(async s => {
    try { const r = await fetch(encodeURI(s)); if (r.ok) BLOBS.set(s, URL.createObjectURL(await r.blob())); } catch (e) {}
  });
  await Promise.race([Promise.all(jobs), new Promise(r => __nbSetTimeout(r, timeoutMs))]);
}
const srcURL = s => BLOBS.get(s) || encodeURI(s);
function mediaSpec(sc, k) {
  const list = C.media || [];
  if (!list.length) return null;
  const ref = (sc.slot.media || [])[k];
  if (typeof ref === "number") return list[ref % list.length];
  if (typeof ref === "string") { const m = list.find(x => x.id === ref); if (m) return m; }
  return list[(sc.idx * 2 + k) % list.length];
}
/* caja de media recortada; o.filter = key de C.grades (o filtro CSS), o.off = desfase del clip */
function mbox(X, parent, k, css = {}, o = {}) {
  let spec = typeof k === "object" ? k : mediaSpec(X.sc, k);
  const box = div(parent, "mbox", css);
  if (!spec) return { box, el: div(box, "media") };
  let filter = o.filter;
  if (filter && GRADE[filter] !== undefined) {
    const g = spec.graded && spec.graded[filter];
    if (g) { spec = { ...spec, src: g.src || spec.src, poster: g.poster || spec.poster }; filter = null; }
    else filter = GRADE[filter];
  }
  let el;
  if (spec.type === "video") {
    el = doc.createElement("video");
    el.muted = true; el.playsInline = true; el.preload = "auto"; el.loop = true;
    if (spec.poster) el.poster = encodeURI(spec.poster);
    el.src = srcURL(spec.src);
    X.videos.push({ v: el, spec, off: o.off || 0 });
  } else { el = doc.createElement("img"); el.src = spec.src; el.decoding = "sync"; }
  el.className = "media";
  if (filter) el.style.filter = filter;
  if (spec.pos) el.style.objectPosition = spec.pos;
  box.appendChild(el);
  return { box, el, spec };
}
/* Ken Burns: en fotos siempre; en video solo con config.render.kbVideo (escalar
   un <video> en cada cuadro cuesta mucho en headless: 45 → 26 fps) */
function kenBurns(X, m, from, to) {
  if (m.spec && m.spec.type === "video" && !C.render?.kbVideo) { m.el.style.transform = from; return; }
  X.T(m.el, "transform", from).to(0, X.dur, to);
}
function syncVideos(X, t, scrub) {
  for (const it of X.videos) {
    const v = it.v, d = v.duration, rate = it.spec.rate || 1;
    let e = (it.spec.start || 0) + (t + it.off) * rate;
    if (isFinite(d) && d > 0.3) e = e % (d - 0.08);
    if (scrub) {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - e) > 0.02) { try { v.currentTime = e; } catch (err) {} }
    } else {
      v.playbackRate = rate;
      if (v.paused) v.play().catch(() => {});
      if (Math.abs(v.currentTime - e) > 0.35) { try { v.currentTime = e; } catch (err) {} }
    }
  }
}

/* ---------------- escenas: construir, montar, buscar ---------------- */
let vw = innerWidth, vh = innerHeight;
function buildScene(sc) {
  const W = vw, H = vh;
  const root = div(null, "scene", { width: W + "px", height: H + "px" });
  const tracks = [];
  const X = {
    sc, root, W, H, u: Math.min(W, H) / 720, dur: sc.dur, videos: [],
    r: mulberry32(((C.seed || 7) * 7919 + sc.idx * 104729) >>> 0),
    T: (el, prop, init, discrete) => { const t = new Track(el, prop, init, discrete); tracks.push(t); return t; }
  };
  X.lines = linesOf(sc);
  X.pend = [];
  try { B[sc.type](sc, X); }
  catch (e) { console.warn(`[${NAME}] escena falló`, sc.type, e); }
  if (sc.kind !== "intro" && sc.t0 === 0 && window.NexaTemplateIntro?.title) {
    const title = window.NexaTemplateIntro.title(C.intro || {});
    if (title) {
      const L = div(root, "lay", { zIndex: 50, pointerEvents: "none" });
      const baseFs = Math.min(0.17 * H, fit(title, ser, 0.04, 0.88 * W, 0.17 * H));
      const titleFs = Math.min(baseFs * 1.45, fit(title, ser, 0.04, 0.94 * W, 0.25 * H));
      const heading = word(X, L, title, { cls: ser, fs: titleFs, x: W / 2, y: 0.5 * H, color: P.bone, ls: 0.04 });
      heading.el.style.whiteSpace = "nowrap";
      heading.el.style.textShadow = "0 0 18px rgba(255,125,55,0.42)";
      X.T(heading.el, "opacity", "0").to(0.02, 0.3, "1", EASE_OUT).to(1.05, 0.35, "0", EASE_IN);
    }
  }
  /* piezas que necesitan medir el texto ya maquetado (garabatos, marcos):
     se monta la escena oculta un instante, se mide y se desmonta */
  if (X.pend.length) {
    root.style.visibility = "hidden"; stage.appendChild(root);
    for (const f of X.pend) { try { f(); } catch (e) { console.warn(`[${NAME}] medición falló`, e); } }
    stage.removeChild(root); root.style.visibility = "";
  }
  if (C.texture?.grain > 0) div(root, "grain", { backgroundImage: GRAIN, opacity: C.texture.grain,
    backgroundPosition: `${Math.floor(X.r() * 192)}px ${Math.floor(X.r() * 192)}px` });
  for (const t of tracks) { t.compile(); t.seek(0); }
  return {
    root, sc,
    seek(t, scrub) { for (const tr of tracks) tr.seek(t); syncVideos(X, t, scrub); },
    dispose() { for (const it of X.videos) { it.v.pause(); it.v.removeAttribute("src"); it.v.load(); } root.remove(); }
  };
}

const stage = $("stage"), audio = $("audio"), hud = $("hud");
let rafT0 = null, rafNow = 0, started = false, forced = FROZEN;
const clock = () => forced != null ? forced
  : (!audio.paused && audio.currentTime > 0.05) ? audio.currentTime
  : (rafT0 === null ? 0 : (rafNow - rafT0) / 1000);
async function begin() {
  if (started || FROZEN != null) return;
  started = true;
  $("hint").style.display = "none";
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
addEventListener("pointerdown", begin, { once: true });

let scenes = [], curIdx = -1, cur = null, nextBuilt = null, prev = null, prevIdx = -1;
/* solapamiento entre escenas (config.transition.overlapSec, def. 0 = corte seco):
   la escena anterior sigue viva DEBAJO de la nueva durante ese tiempo, así la
   transición de entrada (enterFx) se ve contra la imagen real de la anterior */
const OVERLAP = () => Math.max(0, C.transition?.overlapSec ?? 0);
function sceneAt(t) {
  let lo = 0, hi = scenes.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (scenes[m].t0 <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
function mount(i) {
  const old = cur, oldIdx = curIdx;
  cur = (nextBuilt && nextBuilt.i === i) ? nextBuilt.b : buildScene(scenes[i]);
  nextBuilt = null;
  stage.appendChild(cur.root);
  curIdx = i;
  if (prev && prevIdx !== i - 1) { prev.dispose(); prev = null; prevIdx = -1; }
  if (old && old !== prev) {
    if (OVERLAP() > 0 && oldIdx === i - 1 && !prev) { prev = old; prevIdx = oldIdx; }
    else old.dispose();
  }
  if (i + 1 < scenes.length) {
    const j = i + 1;
    __nbSetTimeout(() => { if (curIdx === i && !nextBuilt) nextBuilt = { i: j, b: buildScene(scenes[j]) }; }, 0);
  }
}
function render(t) {
  const i = sceneAt(t);
  if (i < 0) return;
  if (i !== curIdx) mount(i);
  const ov = OVERLAP(), dt = t - scenes[i].t0;
  if (ov > 0 && i > 0 && dt < ov) {
    if (!prev) { prev = buildScene(scenes[i - 1]); prevIdx = i - 1; stage.insertBefore(prev.root, cur.root); }
    /* la anterior sigue corriendo su "cola" (t > dur): sus pistas pueden animar la salida */
    prev.seek(t - scenes[i - 1].t0, forced != null);
  } else if (prev) { prev.dispose(); prev = null; prevIdx = -1; }
  cur.seek(ov > 0 ? t - scenes[i].t0 : Math.min(t, scenes[i].t1) - scenes[i].t0, forced != null);
  if (DEBUG) { const s = scenes[i]; hud.textContent = `t ${t.toFixed(2)} · #${i} ${s.type} · "${s.seg.text}"`; }
}
function frame(now) {
  rafNow = now;
  if (rafT0 === null) rafT0 = now;
  render(clock());
  if (FROZEN == null) requestAnimationFrame(frame);
}

async function boot() {
  if (DEBUG) hud.style.display = "block";
  if (QS.get("headless") === "1") doc.body.classList.add("headless");
  const fontsReady = Promise.race([Promise.all(FONT_LOADS.map(f => doc.fonts.load(f))).then(() => doc.fonts.ready), new Promise(r => __nbSetTimeout(r, 3000))]);
  /* carga primero letra y fuentes: los clips pueden ser pesados y no deben
     ocupar las conexiones que necesita la línea de tiempo. Después se precarga
     media antes de arrancar el reloj, con el límite definido por preloadMedia. */
  const [segs] = await Promise.all([loadScript(), fontsReady]);
  await preloadMedia();
  audio.src = srcURL(C.audio.src);
  const aDur = await new Promise(res => {
    if (isFinite(audio.duration) && audio.duration > 0) return res(audio.duration);
    audio.addEventListener("loadedmetadata", () => res(audio.duration), { once: true });
    __nbSetTimeout(() => res(NaN), 2500);
  });
  if (segs.length) {
    const last = segs[segs.length - 1];
    const dur = isFinite(aDur) && aDur > 0 ? aDur : (segs.audioDurationSec || last.end || last.start + 3);
    measCache.clear();
    /* una plantilla puede traer su propia línea de tiempo (las de letra de canción) */
    scenes = (typeof makeTimeline === "function" ? makeTimeline : buildTimeline)(segs, dur);
  }
  addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; measCache.clear(); nextBuilt = null; if (prev) { prev.dispose(); prev = null; prevIdx = -1; } if (cur) { cur.dispose(); cur = null; curIdx = -1; } });
  window.__promo = {
    scenes: () => scenes,
    seek(t) { forced = t; render(t); return new Promise(res => { const vs = cur ? [...cur.root.querySelectorAll("video")] : [];
      Promise.all(vs.map(v => new Promise(r => { if (v.readyState >= 2 && !v.seeking) r(); else { v.addEventListener("seeked", r, { once: true }); v.addEventListener("loadeddata", r, { once: true }); __nbSetTimeout(r, 1500); } })))
        .then(() => requestAnimationFrame(() => requestAnimationFrame(res))); }); },
    release() { forced = null; }
  };
  requestAnimationFrame(frame);
  if (FROZEN == null) begin();
}
/* ===================== FIN NÚCLEO COMÚN ===================== */

/* ============ BASE · ESCENAS DE lyrics-grunge (se conservan sin cambios) ============
   Réplica del lyric video grunge de rap: metraje en blanco y negro duro con
   niebla y bordes de papel rasgado, letra condensada gastada (máscara de
   desgaste) en blanco y rojo, fantasmas con desenfoque de movimiento, filas
   repetidas en grilla, palabras gigantes que se aplastan contra la cámara y
   garabatos de tiza blanca (círculo, subrayado, flechas, tachón, corona,
   rayo, cruces) que se dibujan solos. Barridos de "mancha" entre escenas.
   La letra viene de lyrics.json (Whisper); el mazo de escenas de config.layouts. */
const P = C.palette;
const U = s => String(s).toUpperCase();
const J = ws => ws.map(w => w.text).join(" ");
const show = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };
function rows(ws, n) {
  if (n <= 1 || ws.length <= 1) return [ws];
  const total = J(ws).length, out = [[]]; let acc = 0;
  for (const w of ws) {
    if (out[out.length - 1].length && acc >= total * out.length / n && out.length < n) out.push([]);
    out[out.length - 1].push(w); acc += w.text.length + 1;
  }
  return out.filter(r => r.length);
}

/* ---- máscara de desgaste para la letra (manchas y rayas transparentes) ---- */
const DISTRESS = (() => {
  const cv = doc.createElement("canvas"); cv.width = cv.height = 256;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#000"; cx.fillRect(0, 0, 256, 256);
  cx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 900; i++) { cx.fillStyle = `rgba(0,0,0,${0.4 + texRng() * 0.6})`; const s = 0.6 + texRng() * 2.2; cx.fillRect(texRng() * 256, texRng() * 256, s, s); }
  for (let i = 0; i < 14; i++) { cx.strokeStyle = `rgba(0,0,0,${0.3 + texRng() * 0.5})`; cx.lineWidth = 0.6 + texRng(); cx.beginPath(); const x = texRng() * 256, y = texRng() * 256; cx.moveTo(x, y); cx.lineTo(x + (texRng() - 0.5) * 90, y + (texRng() - 0.5) * 12); cx.stroke(); }
  return `url(${cv.toDataURL()})`;
})();
doc.documentElement.style.setProperty("--distress", DISTRESS);

/* ---------------- fondo: metraje B/N + niebla + papel rasgado ---------------- */
function jagged(w, h, amp, r, top) {
  const pts = [], n = Math.ceil(w / 14);
  for (let i = 0; i <= n; i++) pts.push([i / n * w, (top ? h : 0) + (top ? -1 : 1) * (amp * (0.3 + r() * 0.7))]);
  return top ? `polygon(0px 0px, ${w}px 0px, ${pts.reverse().map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`
             : `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${(h - y).toFixed(1)}px`).join(", ")}, ${w}px ${h}px, 0px ${h}px)`;
}
function tornEdge(X, L, top, color, hf) {
  const { W, H, r } = X, h = hf * H;
  return div(L, "patch", { left: 0, top: (top ? 0 : H - h) + "px", width: W + "px", height: h + "px", background: color, clipPath: jagged(W, h, h * 0.35, r, top) });
}
function bgLayer(X) {
  const { W, H, r, sc } = X;
  const L = div(X.root, "lay", { background: P.black });
  const m = mbox(X, L, 0, { left: 0, top: 0, width: W + "px", height: H + "px" }, { filter: "bw", off: r() * 4 });
  kenBurns(X, m, "scale(1.04)", "scale(1.1)");
  /* niebla: dos manchas claras que derivan */
  for (let i = 0; i < 2; i++) {
    const f = div(L, "lay", { background: `radial-gradient(ellipse at ${20 + r() * 60}% ${20 + r() * 60}%, rgba(235,235,235,${0.28 + r() * 0.22}) 0%, transparent 45%)` });
    X.T(f, "transform", "translateX(0px)").to(0, X.dur, `translateX(${(r() - 0.5) * 0.2 * W}px)`);
  }
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.6) 100%)" });
  const e = r();
  if (e < 0.35) tornEdge(X, L, true, r() < 0.5 ? P.white : P.black, 0.12 + r() * 0.08);
  else if (e < 0.7) tornEdge(X, L, false, r() < 0.5 ? P.white : P.black, 0.12 + r() * 0.08);
  return L;
}
/* barrido de "mancha" al entrar: barras estiradas con desenfoque, 0.14 s */
function smear(X, L) {
  if (X.sc.idx === 0 || X.r() < 0.35) return;
  const { W, H, r } = X, g = div(L, "lay", { visibility: "hidden" });
  for (let i = 0; i < 5; i++)
    div(g, "patch", { left: -0.1 * W + "px", top: r() * H + "px", width: 1.2 * W + "px", height: (0.03 + r() * 0.12) * H + "px",
      background: r() < 0.4 ? P.red : `rgba(240,240,240,${0.5 + r() * 0.4})`, filter: "url(#mbx3)" });
  X.T(g, "visibility", "visible", true).set(0.14, "hidden");
}

/* ---------------- texto ---------------- */
function word(X, L, s, o) {
  const t = tx(L, U(s), { cls: o.cls || "cd", fs: o.fs, x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, color: o.color || P.white, ls: o.ls, split: o.split });
  if (o.distress !== false) t.el.classList.add("gr");
  return t;
}
/* línea con palabras en su tiempo */
function line(X, L, ws, o) {
  const t = word(X, L, J(ws), { ...o, split: "words" });
  t.words.forEach((s, i) => show(X, s, Math.max(0.02, ws[i]?.rt ?? 0)));
  return t;
}
/* golpe: entra grande y desenfocado, se asienta; fantasma detrás en rojo/blanco */
function slamIn(X, t, at, from = 1.35) {
  X.T(t.el, "transform", `scale(${from})`).to(at, 0.2, "scale(1)", EASE_OUT);
  blurPass(X.T(t.el, "filter", "none", true), at, 0.18, X.r() < 0.5 ? "x" : "y");
  show(X, t.box, at);
}
function ghost(X, L, s, o, at, color) {
  const g = word(X, L, s, { ...o, color, distress: false });
  g.el.style.opacity = "0.55"; g.el.style.filter = "url(#mbx2)";
  X.T(g.el, "transform", `translateX(${(X.r() < 0.5 ? -1 : 1) * 0.04 * X.W}px)`).to(at, X.dur, `translateX(${(X.r() - 0.5) * 0.02 * X.W}px)`);
  show(X, g.box, at);
  return g;
}

/* ---------------- garabatos de tiza (SVG que se dibuja) ---------------- */
function doodle(X, L, kind, b, t0, d = 0.35) {
  const { W, H, u, r } = X;
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  const j = a => (r() - 0.5) * a;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let paths = [];
  if (kind === "circle") {
    const pts = []; for (let i = 0; i <= 40; i++) { const a = -0.4 + i / 40 * Math.PI * 2.15; pts.push([cx + Math.cos(a) * (b.w * 0.62 + j(8 * u)), cy + Math.sin(a) * (b.h * 0.85 + j(6 * u))]); }
    paths.push("M" + pts.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L"));
  } else if (kind === "underline") {
    paths.push(`M${b.x - 10 * u} ${b.y + b.h * 1.08} Q ${cx} ${b.y + b.h * 1.2 + j(10 * u)} ${b.x + b.w + 14 * u} ${b.y + b.h * 1.02}`);
  } else if (kind === "strike") {
    paths.push(`M${b.x - 8 * u} ${cy + j(6 * u)} L ${b.x + b.w + 8 * u} ${cy + j(8 * u)}`);
  } else if (kind === "arrows") {
    for (const [x, dir] of [[b.x - 0.06 * W, -1], [b.x + b.w + 0.06 * W, 1]]) {
      const y0 = cy + dir * 0.12 * H, y1 = cy - dir * 0.12 * H;
      paths.push(`M${x} ${y0} L ${x + j(4 * u)} ${y1}`, `M${x - 14 * u} ${y1 + dir * 16 * u} L ${x} ${y1} L ${x + 14 * u} ${y1 + dir * 16 * u}`);
    }
  } else if (kind === "crown") {
    const x = b.x + b.w * 0.1, y = b.y - 0.05 * H, w = 0.06 * W, h = 0.05 * H;
    paths.push(`M${x} ${y + h} L ${x} ${y} L ${x + w * 0.3} ${y + h * 0.6} L ${x + w * 0.5} ${y - h * 0.1} L ${x + w * 0.7} ${y + h * 0.6} L ${x + w} ${y} L ${x + w} ${y + h} Z`);
  } else if (kind === "bolt") {
    const x = b.x + b.w * (0.3 + r() * 0.4), y = b.y - 0.02 * H, h = b.h * 1.2;
    paths.push(`M${x + 20 * u} ${y} L ${x - 18 * u} ${y + h * 0.55} L ${x + 10 * u} ${y + h * 0.5} L ${x - 20 * u} ${y + h}`);
  } else if (kind === "cross") {
    for (let i = 0; i < 4; i++) { const x = b.x + r() * b.w, y = b.y - 0.1 * H + r() * (b.h + 0.2 * H), k = (8 + r() * 10) * u; paths.push(`M${x - k} ${y - k} L ${x + k} ${y + k}`, `M${x + k} ${y - k} L ${x - k} ${y + k}`); }
  } else if (kind === "box") {
    const p = 14 * u;
    paths.push(`M${b.x - p} ${b.y - p + j(6 * u)} L ${b.x + b.w + p} ${b.y - p} L ${b.x + b.w + p + j(6 * u)} ${b.y + b.h + p} L ${b.x - p} ${b.y + b.h + p + j(6 * u)} Z`);
  }
  s.innerHTML = paths.map(d0 => `<path d="${d0}" fill="none" stroke="${P.chalk}" stroke-width="${Math.max(2, 5 * u)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join("");
  L.appendChild(s);
  s.style.filter = "url(#chalk)";
  [...s.querySelectorAll("path")].forEach((p, i) => X.T(p, "strokeDashoffset", "1").to(t0 + i * 0.06, d, "0", EASE_OUT));
  return s;
}
fx.insertAdjacentHTML("beforeend", `<filter id="chalk"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>`);
const box = (X, t) => { const r = t.el.getBoundingClientRect(), R = X.root.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height }; };
/* el tamaño real sale del layout: medimos en el cuadro siguiente al montaje */
function later(X, t, fn) { X.pend.push(() => fn(box(X, t))); }

const B = {};

B.slam = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, s = J(ws);
  const red = X.r() < 0.45, fs = fit(U(s), "cd", 0.01, 0.86 * W, 0.46 * H);
  const o = { cls: "cd", fs, x: W / 2, y: 0.5 * H, color: red ? P.red : P.white, ls: 0.01 };
  ghost(X, L, s, o, Math.max(0.02, ws[0].rt), red ? P.white : P.red);
  const t = line(X, L, ws, o);
  slamIn(X, t, Math.max(0.02, ws[0].rt));
  const k = ["underline", "strike", "cross", "none"][Math.floor(X.r() * 4)];
  if (k !== "none") later(X, t, b => doodle(X, L, k, b, Math.max(0.2, ws[ws.length - 1].rt + 0.1)));
  smear(X, L);
};

B.twoTone = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const [a, b] = rows(ws, 2);
  const fa = fit(U(J(a)), "cd", 0.01, 0.8 * W, 0.13 * H);
  line(X, L, a, { cls: "cd", fs: fa, x: W / 2, y: 0.3 * H, color: P.red });
  if (b) {
    const thin = X.r() < 0.5 && J(b).length <= 12;
    const fb = fit(U(J(b)), thin ? "th" : "cd", thin ? 0.12 : 0.01, 0.78 * W, 0.34 * H);
    const t = line(X, L, b, { cls: thin ? "th" : "cd", fs: fb, x: W / 2, y: 0.62 * H, color: P.white, ls: thin ? 0.12 : 0.01 });
    slamIn(X, t, Math.max(0.03, b[0].rt), 1.2);
    later(X, t, bx => doodle(X, L, X.r() < 0.5 ? "crown" : "bolt", bx, Math.max(0.2, b[0].rt + 0.15)));
  }
  smear(X, L);
};

B.circle = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws);
  const hero = ws[hi].text, fs = fit(U(hero), "cd", 0.01, 0.46 * W, 0.26 * H);
  const t = word(X, L, hero, { cls: "cd", fs, x: W / 2, y: 0.46 * H, color: P.red });
  slamIn(X, t, Math.max(0.03, ws[hi].rt), 1.15);
  const rest = ws.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: "cd", fs: Math.min(0.08 * H, fit(U(J(rest)), "cd", 0.02, 0.6 * W, 1e9)), x: W / 2, y: 0.46 * H + fs * 0.62, color: P.white, ls: 0.02 });
  later(X, t, b => doodle(X, L, "circle", b, Math.max(0.1, ws[hi].rt + 0.12), 0.4));
  smear(X, L);
};

B.spacedWide = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws);
  const hero = U(ws[hi].text).split("").join(" "), rest = ws.filter((_, i) => i !== hi);
  const fs = fit(hero, "ex", 0.25, 0.8 * W, 0.16 * H);
  const t = word(X, L, hero, { cls: "ex", fs, x: W / 2, y: 0.58 * H, color: P.white, ls: 0.25 });
  show(X, t.box, Math.max(0.03, ws[hi].rt));
  X.T(t.el, "letterSpacing", "0.7em").to(Math.max(0.03, ws[hi].rt), 0.35, "0.25em", EASE_OUT);
  if (rest.length) {
    const fr = fit(U(J(rest)), "cd", 0.02, 0.5 * W, 0.2 * H);
    const r1 = line(X, L, rest, { cls: "cd", fs: fr, x: W / 2, y: 0.58 * H - fs * 0.5 - fr * 0.45, color: P.red, ls: 0.02 });
  }
  later(X, t, b => doodle(X, L, "arrows", b, Math.max(0.2, ws[hi].rt + 0.1)));
  smear(X, L);
};

B.grid = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, s = U(J(ws));
  const cols = s.length <= 10 ? 3 : 2, rw = 3, cw = W / cols, rh = H / rw;
  const fs = fit(s, "cd", 0.01, cw * 0.92, rh * 0.8);
  let k = 0;
  for (let r = 0; r < rw; r++) for (let c = 0; c < cols; c++, k++) {
    const t = word(X, L, s, { cls: "cd", fs, x: (c + 0.5) * cw, y: (r + 0.5) * rh, color: (r + c) % 3 === 1 ? P.red : P.white, ls: 0.01 });
    const at = Math.max(0.02, ws[0].rt) + k * 0.035;
    show(X, t.box, at);
    X.T(t.el, "transform", "scaleX(2.2)").to(at, 0.2, "scaleX(1)", EASE_OUT);
    blurPass(X.T(t.el, "filter", "none", true), at, 0.18, "x");
  }
};

B.stackCols = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const a = ws.slice(0, 1), b = ws.slice(1);
  const n = 4, lh = 0.19 * H, y0 = 0.5 * H - (n - 1) * lh / 2;
  const fa = Math.min(lh * 0.95, fit(U(J(a)), "ex", 0, 0.24 * W, 1e9));
  const fb = b.length ? Math.min(lh * 0.95, fit(U(J(b)), "cd", 0.01, 0.56 * W, 1e9)) : 0;
  for (let i = 0; i < n; i++) {
    const at = Math.max(0.02, ws[0].rt) + i * 0.06;
    const ta = word(X, L, J(a), { cls: "ex", fs: fa, x: 0.3 * W, y: y0 + i * lh, ax: 1, color: P.white });
    show(X, ta.box, at);
    if (b.length) { const tb = word(X, L, J(b), { cls: "cd", fs: fb, x: 0.33 * W, y: y0 + i * lh, ax: 0, color: P.red, ls: 0.01 }); show(X, tb.box, Math.max(at, b[0].rt)); }
  }
};

B.torn = (sc, X) => {
  const { W, H, r } = X, L = bgLayer(X), ws = sc.words;
  const band = div(L, "patch", { left: 0, top: 0.22 * H + "px", width: W + "px", height: 0.56 * H + "px", background: P.paper });
  band.style.clipPath = `polygon(${Array.from({ length: 41 }, (_, i) => `${i / 40 * W}px ${(0.02 + r() * 0.05) * H}px`).join(", ")}, ${Array.from({ length: 41 }, (_, i) => `${(40 - i) / 40 * W}px ${(0.51 + r() * 0.05) * H}px`).join(", ")})`;
  X.T(band, "transform", "scaleY(0)").to(0, 0.16, "scaleY(1)", EASE_OUT);
  const ls = rows(ws, Math.min(3, Math.max(1, Math.ceil(ws.length / 2))));
  const fs = Math.min(...ls.map(l => fit(U(J(l)), "ex", 0.02, 0.78 * W, 0.14 * H)));
  const y0 = 0.5 * H - (ls.length - 1) * fs * 0.5;
  ls.forEach((l, i) => line(X, L, l, { cls: "ex", fs, x: W / 2, y: y0 + i * fs, color: i % 2 ? P.red : P.ink, ls: 0.02 }));
};

B.vertical = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws);
  const chars = U(ws[hi].text).split(""), n = chars.length, fs = Math.min(0.16 * H, (0.86 * H) / n);
  chars.forEach((c, i) => {
    const t = word(X, L, c, { cls: "cd", fs, x: W / 2, y: 0.5 * H + (i - (n - 1) / 2) * fs * 0.95, color: P.red });
    const at = Math.max(0.02, ws[hi].rt) + i * 0.05;
    show(X, t.box, at); X.T(t.el, "transform", "translateY(-60%)").to(at, 0.15, "translateY(0%)", EASE_OUT);
  });
  const rest = ws.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: "ex", fs: 0.07 * H, x: W / 2, y: 0.5 * H, color: P.white, ls: 0.4 });
  smear(X, L);
};

B.frameBox = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const [a, b] = rows(ws, 2);
  const fa = fit(U(J(a)), "cd", 0.01, 0.72 * W, 0.16 * H);
  const ta = line(X, L, a, { cls: "cd", fs: fa, x: W / 2, y: 0.36 * H, color: P.red, ls: 0.01 });
  if (b) line(X, L, b, { cls: "cd", fs: fa * 0.6, x: W / 2 - 0.3 * W, y: 0.36 * H + fa * 0.85, ax: 0, color: P.white, ls: 0.02 });
  later(X, ta, bx => doodle(X, L, "box", { ...bx, h: bx.h * (b ? 1.9 : 1) }, Math.max(0.1, ws[0].rt + 0.1), 0.5));
  smear(X, L);
};

B.stack3 = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const ls = rows(ws, Math.min(3, ws.length));
  const fs = Math.min(...ls.map(l => fit(U(J(l)), "cd", 0.01, 0.78 * W, 0.24 * H)));
  const y0 = 0.5 * H - (ls.length - 1) * fs * 0.48;
  ls.forEach((l, i) => {
    const t = line(X, L, l, { cls: "cd", fs, x: 0.1 * W, y: y0 + i * fs * 0.96, ax: 0, color: i === 1 ? P.red : P.white, ls: 0.01 });
    X.T(t.el, "transform", "translateX(-8%)").to(Math.max(0, l[0].rt), 0.22, "translateX(0%)", EASE_OUT);
  });
};

B.blurGiant = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, s = J(ws);
  const fs = fit(U(s), "cd", 0.01, 0.94 * W, 0.7 * H), o = { cls: "cd", fs, x: W / 2, y: 0.5 * H, color: P.red, ls: 0.01 };
  for (let i = 0; i < 2; i++) ghost(X, L, s, o, Math.max(0.02, ws[0].rt), P.red);
  const t = line(X, L, ws, o);
  t.el.style.mixBlendMode = "screen";
  X.T(t.el, "filter", "url(#mbx3)", true).set(Math.max(0.02, ws[0].rt) + 0.12, "url(#mbx1)").set(Math.max(0.02, ws[0].rt) + 0.26, "none");
  X.T(t.el, "transform", "scale(1.12)").to(0, X.dur, "scale(1)");
};

B.strike = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const [a, b] = rows(ws, 2);
  const fa = fit(U(J(a)), "cd", 0.02, 0.62 * W, 0.12 * H);
  const ta = line(X, L, a, { cls: "cd", fs: fa, x: W / 2, y: 0.4 * H, color: P.red, ls: 0.02 });
  later(X, ta, bx => doodle(X, L, "strike", bx, Math.max(0.15, a[a.length - 1].rt + 0.1), 0.25));
  if (b) { const fb = fit(U(J(b)), "cd", 0.01, 0.7 * W, 0.2 * H); const tb = line(X, L, b, { cls: "cd", fs: fb, x: W / 2, y: 0.4 * H + fa * 0.6 + fb * 0.5, color: P.white, ls: 0.01 }); slamIn(X, tb, Math.max(0.05, b[0].rt), 1.15); }
  smear(X, L);
};


const FITS = {
  slam: sc => J(sc.words).length <= 18,
  twoTone: sc => sc.words.length >= 2,
  circle: sc => sc.words[heroIdx(sc.words)].text.length <= 9,
  spacedWide: sc => sc.words[heroIdx(sc.words)].text.length <= 7,
  grid: sc => J(sc.words).length <= 16,
  stackCols: sc => sc.words.length >= 2 && sc.words[0].text.length <= 5,
  torn: sc => sc.words.length >= 2,
  vertical: sc => sc.words[heroIdx(sc.words)].text.length <= 6,
  frameBox: sc => sc.words.length >= 2,
  stack3: sc => sc.words.length >= 3,
  blurGiant: sc => J(sc.words).length <= 12,
  strike: sc => sc.words.length >= 2
};

/* ============================ MONTAJE · lyrics-grunge-montage ============================
   Variante de lyrics-grunge con LINEA DE TIEMPO EXPLICITA. Si config.timeline existe,
   cada escena la dirige el JSON: { t0, t1, bg, pieces[], tr } (tiempos de la referencia,
   config.timeOffsetSec se resta al reloj de la cancion). Sin timeline se usa el mazo
   procedural de la base (B.* + FITS de arriba). Todo el contenido (texto, medios, tiempos,
   colores, posiciones) sale del JSON: el codigo solo dibuja piezas.
   Piezas (k): text · stack · grid · chalk · rect · paper · glitch · outro.
   Posiciones y tamanos en fracciones del lienzo (x/W, y/H; fs = alto de fuente / H). */
const TOFF = Number(C.timeOffsetSec) || 0;
const COL = k => ({ red: P.red, white: P.white, black: P.black, paper: P.paper, ink: P.ink, chalk: P.chalk })[k] || k;
/* una sola pista por (elemento, propiedad): entrada y salida comparten la misma */
const TRK = (X, el, prop, init, discrete) => { const m = el.__tr || (el.__tr = {}); return m[prop] || (m[prop] = X.T(el, prop, init, discrete)); };
const visTo = (X, el, at, until) => {
  const t = TRK(X, el, "visibility", at > 0.001 ? "hidden" : "visible", true);
  if (at > 0.001) t.set(at, "visible");
  if (until != null) t.set(until, "hidden");
};
const rnd = (X, a = 1) => (X.r() - 0.5) * a;

/* ---------------- filtros extra: pincel seco y borde rugoso ---------------- */
fx.insertAdjacentHTML("beforeend", `<filter id="brush" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="8" result="w"/>
  <feDisplacementMap in="SourceGraphic" in2="w" scale="9" result="d"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.85" result="m"/>
  <feComposite in="d" in2="m" operator="in"/></filter>`);

/* ---------------- fondo: clip B/N, niebla, vineta, bordes de papel rasgado ---------------- */
function edgePoly(W, H, e, r) {
  const jig = (n, amp) => Array.from({ length: n + 1 }, () => amp * (0.35 + r() * 0.65));
  const d = e.d ?? 0.12, j = e.j ?? 0.35, n = 34;
  const P2 = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
  const side = e.side;
  if (side === "top" || side === "bottom") {
    const dep = d * H, js = jig(n, dep * j), line = js.map((a, i) => [i / n * W, dep + (a - dep * j * 0.5)]);
    return side === "top" ? P2([[0, 0], [W, 0], ...line.slice().reverse()])
      : P2([[0, H], ...line.map(([x, y]) => [x, H - y]), [W, H]]);
  }
  if (side === "left" || side === "right") {
    const dep = d * W, js = jig(n, dep * j), line = js.map((a, i) => [dep + (a - dep * j * 0.5), i / n * H]);
    return side === "left" ? P2([[0, 0], ...line, [0, H]])
      : P2([[W, 0], [W, H], ...line.slice().reverse().map(([x, y]) => [W - x, y])]);
  }
  /* esquinas: tl tr bl br · rasgon diagonal */
  const a = d * W, b = (e.dy ?? d * 1.2) * H, pts = [];
  for (let i = 0; i <= 20; i++) { const p = i / 20; pts.push([a * (1 - p) + rnd({ r }, a * j * 0.5), b * p + rnd({ r }, b * j * 0.5)]); }
  const fl = ([x, y]) => [side[1] === "r" ? W - x : x, side[0] === "b" ? H - y : y];
  const cx = side[1] === "r" ? W : 0, cy = side[0] === "b" ? H : 0;
  return P2([[cx, cy], fl([a, 0]), ...pts.map(fl), fl([0, b])]);
}
function bgScene(X, d = {}) {
  const { W, H, r } = X;
  const L = div(X.root, "lay", { background: d.paper ? "#8e8e8b" : d.light ? "#c4c4c1" : P.black });
  if (d.light) {
    /* niebla clara: gris perla con nubes oscuras y claras que derivan (escenas "blancas" de la referencia) */
    for (const [x, y, sz, c] of d.blobs || [[18, 30, 42, "rgba(70,70,68,0.55)"], [78, 70, 38, "rgba(90,90,88,0.45)"], [60, 25, 35, "rgba(245,245,243,0.75)"], [30, 80, 40, "rgba(235,235,233,0.6)"]]) {
      const f = div(L, "lay", { background: `radial-gradient(ellipse at ${x}% ${y}%, ${c} 0%, transparent ${sz}%)` });
      X.T(f, "transform", "translateX(0px)").to(0, X.dur, `translateX(${rnd(X, 0.08) * W}px)`);
    }
  } else if (!d.paper) {
    const m = mbox(X, L, 0, { left: 0, top: 0, width: W + "px", height: H + "px" }, { filter: d.grade === undefined ? "bw" : d.grade, off: d.off ?? r() * 4 });
    if (d.flip) m.box.style.transform = "scaleX(-1)";
    const k = d.kb || [1.04, 1.1]; kenBurns(X, m, `scale(${k[0]})`, `scale(${k[1]})`);
    const dk = (d.dark ?? 0) * (C.look?.darkScale ?? 1);
    if (dk > 0.001) div(L, "lay", { background: `rgba(0,0,0,${dk})` });
    if (C.look?.haze) div(L, "lay", { background: `rgba(225,225,222,${C.look.haze})`, mixBlendMode: "screen" });
  } else {
    /* tarjeta de papel: oscuro a la izquierda, manchas claras a la derecha */
    div(L, "lay", { background: "linear-gradient(90deg, #141414 0%, #6a6a68 28%, #b4b4b1 62%, #d9d9d6 100%)" });
    for (const [x, y, s, a] of d.blobs || [[70, 70, 38, 0.55], [38, 30, 30, 0.35], [88, 25, 26, 0.4]])
      div(L, "lay", { background: `radial-gradient(ellipse at ${x}% ${y}%, rgba(240,240,238,${a}) 0%, transparent ${s}%)` });
  }
  const fog = d.fog ?? 1;
  if (fog > 0 && !d.paper && !d.light) for (let i = 0; i < 2; i++) {
    const f = div(L, "lay", { background: `radial-gradient(ellipse at ${20 + r() * 60}% ${20 + r() * 60}%, rgba(235,235,235,${(0.28 + r() * 0.22) * fog * (C.look?.fogScale ?? 1)}) 0%, transparent ${C.look?.fogSize ?? 45}%)` });
    X.T(f, "transform", "translateX(0px)").to(0, X.dur, `translateX(${rnd(X, 0.2) * W}px)`);
  }
  if (!d.paper && !d.light) div(L, "lay", { background: `radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,${d.vig ?? C.look?.vignette ?? 0.6}) 100%)` });
  for (const e of d.edges || []) {
    const col = e.color === "black" ? P.black : e.color === "white" ? P.white : e.color || P.paper;
    const polys = [edgePoly(W, H, e, r), edgePoly(W, H, e, r), edgePoly(W, H, e, r)];
    const patch = div(L, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: col, clipPath: polys[0] });
    if (e.boil !== false) patch.dataset.edge = JSON.stringify(polys);
    div(patch, "lay", { backgroundImage: GRAIN, opacity: 0.22 });
    if (e.fog) div(patch, "lay", { background: `radial-gradient(ellipse at ${e.fx ?? 50}% ${e.fy ?? 50}%, rgba(120,120,118,${e.fog}) 0%, transparent 70%)` });
    if (e.at) { patch.style.visibility = "hidden"; visTo(X, patch, e.at, e.until); }
    else if (e.until != null) visTo(X, patch, 0, e.until);
  }
  return L;
}

/* ---------------- trazos de tiza / pincel (SVG que se dibuja solo) ---------------- */
function strokes(X, L, paths, o = {}) {
  const { W, H, u } = X;
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  const sw = Math.max(1.5, (o.sw ?? 5) * u * (C.strokeScale ?? 2.3)), col = COL(o.color || "chalk");
  s.innerHTML = paths.map(d0 => `<path d="${d0}" fill="${o.fill || "none"}" stroke="${col}" stroke-width="${sw}" stroke-linecap="${o.cap || "round"}" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join("");
  L.appendChild(s);
  s.style.filter = o.rough === false ? "none" : (o.sw ?? 5) >= 7 ? "url(#brush)" : "url(#chalk)";
  if (o.op != null) s.style.opacity = o.op;
  const at = o.at ?? 0, d = o.d ?? 0.35;
  const ps = [...s.querySelectorAll("path")];
  ps.forEach((p, i) => {
    const tr = X.T(p, "strokeDashoffset", "1").to(at + i * (o.step ?? 0.06), d, "0", EASE_OUT);
    /* borrado: el trazo se deshace en el mismo sentido en que se dibujó (cierre de la referencia) */
    if (o.erase) tr.to(o.erase.at + (ps.length - 1 - i) * (o.erase.step ?? 0.05), o.erase.d ?? 0.25, "-1", EASE_IN);
  });
  if (o.at != null && o.at > 0.001) { s.style.visibility = "hidden"; visTo(X, s, at, o.until); }
  else if (o.until != null) visTo(X, s, 0, o.until);
  return s;
}
const poly = pts => "M" + pts.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L");
const SHAPE = {
  /* b = caja del texto en px; o = parametros de la pieza */
  ellipse(b, X, o) { const { u, r } = X, cx = b.x + b.w / 2 + (o.ox || 0) * X.W, cy = b.y + b.h / 2 + (o.oy || 0) * X.H, rx = b.w * (o.rx ?? 0.62), ry = b.h * (o.ry ?? 0.8), a0 = o.a0 ?? -0.5, turns = o.turns ?? 1.12, pts = [];
    for (let i = 0; i <= 48; i++) { const a = a0 + i / 48 * Math.PI * 2 * turns, k = 1 + (i / 48) * 0.06; pts.push([cx + Math.cos(a) * rx * k + rnd(X, 5 * u), cy + Math.sin(a) * ry * k + rnd(X, 5 * u)]); }
    return [poly(pts)]; },
  spiral(b, X, o) { const { u } = X, cx = b.x + b.w / 2, cy = b.y + b.h / 2, pts = [], turns = o.turns ?? 2.2;
    for (let i = 0; i <= 70; i++) { const p = i / 70, a = -0.4 + p * Math.PI * 2 * turns, k = 0.78 + p * 0.3; pts.push([cx + Math.cos(a) * b.w * 0.58 * k + rnd(X, 4 * u), cy + Math.sin(a) * b.h * 0.95 * k + rnd(X, 4 * u)]); }
    return [poly(pts)]; },
  underline(b, X, o) { const { u } = X, y = b.y + b.h * (o.dy ?? 1.1); return [`M${b.x - 10 * u} ${y} Q ${b.x + b.w / 2} ${y + rnd(X, 14 * u)} ${b.x + b.w + 14 * u} ${y - 4 * u}`]; },
  strike(b, X, o) { const { u } = X, cy = b.y + b.h * (o.dy ?? 0.5); return [`M${b.x - 12 * u} ${cy + rnd(X, 6 * u)} L ${b.x + b.w + 12 * u} ${cy + rnd(X, 8 * u)}`]; },
  brush(b, X, o) { const { u } = X, cy = b.y + b.h * (o.dy ?? 0.5); return [`M${b.x - 20 * u} ${cy + rnd(X, 8 * u)} C ${b.x + b.w * 0.3} ${cy - 10 * u}, ${b.x + b.w * 0.7} ${cy + 10 * u}, ${b.x + b.w + 20 * u} ${cy + rnd(X, 10 * u)}`]; },
  cross(b, X, o) { const { u } = X, out = [], n = o.n ?? 6; for (let i = 0; i < n; i++) { const x = b.x + X.r() * b.w * 1.1 - b.w * 0.05, y = b.y - b.h * 0.6 + X.r() * b.h * 2.2, k = (6 + X.r() * 9) * u; out.push(`M${x - k} ${y - k} L ${x + k} ${y + k}`, `M${x + k} ${y - k} L ${x - k} ${y + k}`); } return out; },
  crown(b, X, o) { const { W, H } = X, x = b.x + b.w * (o.cx ?? 0.1), y = b.y - (o.up ?? 0.07) * H, w = (o.w ?? 0.075) * W, h = (o.h ?? 0.06) * H; return [`M${x} ${y + h} L ${x - w * 0.04} ${y} L ${x + w * 0.28} ${y + h * 0.62} L ${x + w * 0.5} ${y - h * 0.12} L ${x + w * 0.72} ${y + h * 0.62} L ${x + w * 1.04} ${y} L ${x + w} ${y + h} Z`]; },
  bolt(b, X, o) { const { u } = X, x = b.x + b.w * (o.cx ?? 0.5), y = b.y - 0.02 * X.H, h = b.h * (o.h ?? 1.3); return [`M${x + 22 * u} ${y} L ${x - 18 * u} ${y + h * 0.55} L ${x + 12 * u} ${y + h * 0.5} L ${x - 22 * u} ${y + h}`]; },
  arrowR(b, X, o) { const { u } = X, x0 = b.x - (o.len ?? 0.09) * X.W, x1 = b.x - 8 * u, y = b.y + b.h * 0.5; return [`M${x0} ${y} L ${x1} ${y}`, `M${x1 - 16 * u} ${y - 13 * u} L ${x1} ${y} L ${x1 - 16 * u} ${y + 13 * u}`]; },
  arrowUp(b, X, o) { const { u } = X, x = b.x + b.w * (o.cx ?? 0.5), y0 = b.y + b.h * (o.y0 ?? 1.2), y1 = b.y + b.h * (o.y1 ?? -0.3); return [`M${x} ${y0} L ${x + rnd(X, 5 * u)} ${y1}`, `M${x - 16 * u} ${y1 + 22 * u} L ${x} ${y1} L ${x + 16 * u} ${y1 + 22 * u}`]; },
  arrowDown(b, X, o) { const { u } = X, x = b.x + b.w * (o.cx ?? 0.5), y0 = b.y + b.h * (o.y0 ?? -0.3), y1 = b.y + b.h * (o.y1 ?? 1.2); return [`M${x} ${y0} L ${x + rnd(X, 5 * u)} ${y1}`, `M${x - 16 * u} ${y1 - 22 * u} L ${x} ${y1} L ${x + 16 * u} ${y1 - 22 * u}`]; },
  arrowDiag(b, X, o) { const { u } = X, cx = b.x + b.w * (o.cx ?? 0.5), cy = b.y + b.h * (o.cy ?? 0.5), L = (o.len ?? 0.1) * X.W, dx = (o.dx ?? 1), dy = (o.dy ?? -1), x1 = cx + dx * L * 0.7, y1 = cy + dy * L * 0.7, x0 = cx - dx * L * 0.3, y0 = cy - dy * L * 0.3, hd = 15 * u;
    return [`M${x0} ${y0} L ${x1} ${y1}`, `M${x1 - dx * hd * 1.4} ${y1} L ${x1} ${y1} L ${x1} ${y1 - dy * hd * 1.4}`]; },
  swoosh(b, X, o) { const { u } = X, x0 = b.x + b.w * (o.x0 ?? 0.1), y0 = b.y + b.h * (o.y0 ?? 1.9), x1 = b.x + b.w * (o.x1 ?? 0.95), y1 = b.y + b.h * (o.y1 ?? 1.5); return [`M${x0} ${y0} Q ${(x0 + x1) / 2} ${y0 + 44 * u} ${x1} ${y1}`, `M${x1 - 22 * u} ${y1 + 6 * u} L ${x1} ${y1} L ${x1 - 8 * u} ${y1 + 22 * u}`]; },
  frame(b, X, o) { const { u } = X, p = (o.pad ?? 16) * u, x0 = b.x - p, y0 = b.y - p, x1 = b.x + b.w + p, y1 = b.y + b.h * (o.hh ?? 1) + p; return [`M${x0} ${y0 + rnd(X, 4 * u)} L ${x1} ${y0} L ${x1 + rnd(X, 5 * u)} ${y1} L ${x0} ${y1 + rnd(X, 5 * u)} Z`]; },
  play(b, X, o) { const s = (o.size ?? 0.055) * X.H, cx = b.x, cy = b.y; return [`M${cx - s * 0.5} ${cy - s * 0.6} L ${cx + s * 0.6} ${cy} L ${cx - s * 0.5} ${cy + s * 0.6} Z`]; },
  next(b, X, o) { const s = (o.size ?? 0.05) * X.H, cx = b.x, cy = b.y; return [`M${cx - s} ${cy - s * 0.55} L ${cx} ${cy} L ${cx - s} ${cy + s * 0.55} Z`, `M${cx} ${cy - s * 0.55} L ${cx + s} ${cy} L ${cx} ${cy + s * 0.55} Z`, `M${cx + s * 1.15} ${cy - s * 0.6} L ${cx + s * 1.15} ${cy + s * 0.6}`]; },
  prev(b, X, o) { const s = (o.size ?? 0.05) * X.H, cx = b.x, cy = b.y; return [`M${cx + s} ${cy - s * 0.55} L ${cx} ${cy} L ${cx + s} ${cy + s * 0.55} Z`, `M${cx} ${cy - s * 0.55} L ${cx - s} ${cy} L ${cx} ${cy + s * 0.55} Z`, `M${cx - s * 1.15} ${cy - s * 0.6} L ${cx - s * 1.15} ${cy + s * 0.6}`]; },
  tri(b, X, o) { const s = (o.size ?? 0.035) * X.H, cx = b.x, cy = b.y, d = o.dir === "left" ? -1 : 1; return [`M${cx - d * s * 0.5} ${cy - s * 0.6} L ${cx + d * s * 0.6} ${cy} L ${cx - d * s * 0.5} ${cy + s * 0.6} Z`]; },
  xmark(b, X, o) { const k = (o.size ?? 0.05) * X.H, cx = b.x, cy = b.y; return [`M${cx - k} ${cy - k} L ${cx + k} ${cy + k}`, `M${cx + k} ${cy - k} L ${cx - k} ${cy + k}`]; },
  plus(b, X, o) { const k = (o.size ?? 0.025) * X.H, cx = b.x, cy = b.y; return [`M${cx - k} ${cy} L ${cx + k} ${cy}`, `M${cx} ${cy - k} L ${cx} ${cy + k}`]; },
  ring(b, X, o) { const { u } = X, k = (o.size ?? 0.03) * X.H, cx = b.x, cy = b.y, pts = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2.1; pts.push([cx + Math.cos(a) * k + rnd(X, 2 * u), cy + Math.sin(a) * k * (o.sq ?? 1) + rnd(X, 2 * u)]); } return [poly(pts)]; },
  star(b, X, o) { const k = (o.size ?? 0.03) * X.H, cx = b.x, cy = b.y, pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? k * 0.45 : k; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return [poly(pts) + " Z"]; },
  face(b, X, o) { const { u } = X, cx = b.x, cy = b.y, k = (o.size ?? 0.085) * X.H, pts = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI * 2.1; pts.push([cx + Math.cos(a) * k * 0.78 + rnd(X, 3 * u), cy + Math.sin(a) * k + rnd(X, 3 * u)]); }
    return [poly(pts), `M${cx - k * 0.3} ${cy - k * 0.15} l 0 ${k * 0.1}`, `M${cx + k * 0.3} ${cy - k * 0.15} l 0 ${k * 0.1}`, `M${cx} ${cy} L ${cx - k * 0.1} ${cy + k * 0.22} L ${cx + k * 0.1} ${cy + k * 0.22}`, `M${cx - k * 0.25} ${cy + k * 0.55} Q ${cx} ${cy + k * 0.4} ${cx + k * 0.25} ${cy + k * 0.55}`]; },
  eyes(b, X, o) { const { u } = X, cx = b.x, cy = b.y, k = (o.size ?? 0.05) * X.H, e = (dx) => { const pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2.1; pts.push([cx + dx + Math.cos(a) * k * 0.4, cy + Math.sin(a) * k * 0.16]); } return poly(pts); }; return [e(-k * 0.55), e(k * 0.55)]; },
  slash(b, X, o) { const { u } = X, cx = b.x + b.w * (o.cx ?? 0.5), cy = b.y + b.h * (o.cy ?? 0.5), L = (o.len ?? 1.5) * b.h, a = (o.ang ?? -62) * Math.PI / 180; return [`M${cx - Math.cos(a) * L / 2} ${cy - Math.sin(a) * L / 2} L ${cx + Math.cos(a) * L / 2} ${cy + Math.sin(a) * L / 2}`]; },
  line(b, X, o) { const { W, H } = X; return [`M${o.x0 * W} ${o.y0 * H} L ${o.x1 * W} ${o.y1 * H}`]; },
  path(b, X, o) { const { W, H } = X; return (o.paths || [o.pts || []]).map(pts => poly(pts.map(([x, y]) => [x * W, y * H]))); }
};
const absBox = (X, a) => ({ x: a.x * X.W, y: a.y * X.H, w: (a.w ?? 0) * X.W, h: (a.h ?? 0) * X.H });

/* ---------------- texto ---------------- */
function textOf(X, L, p, over = {}) {
  const q = { ...p, ...over }, { W, H } = X, cls = q.font || "cd", s = U(slotText(q)), ls = q.ls ?? 0.01;
  const fs = q.fs != null ? q.fs * H : fit(s, cls, ls, (q.w ?? 0.8) * W, (q.h == null ? 9 : q.h < 0.3 ? q.h * (C.textBoost ?? 1.8) : q.h) * H);
  const mode = (q.in === "words" || q.grow) ? "words" : (q.in === "chars" || q.in === "scatter") ? "chars" : undefined;
  const t = tx(L, s, { cls, fs, x: (q.x ?? 0.5) * W, y: (q.y ?? 0.5) * H, ax: q.ax ?? 0.5, ay: q.ay ?? 0.5, color: COL(q.color || "white"), ls, rot: q.rot, split: mode });
  if (q.distress !== false) t.el.classList.add("gr");
  if (q.fw != null) t.el.style.fontWeight = q.fw;
  if (q.fst != null) t.el.style.fontStretch = q.fst;
  if (q.op != null) t.box.style.opacity = q.op;
  if (q.blend) t.box.style.mixBlendMode = q.blend;
  /* palabra roja gigante: el metraje se ve dentro de la letra (como «LIKE» en la referencia) */
  else if (q.screen !== false && COL(q.color || "white") === P.red && fs > 0.3 * H && !over.color) t.box.style.mixBlendMode = "screen";
  if (q.z != null) t.box.style.zIndex = q.z;
  if (q.glow) t.el.style.textShadow = `0 0 ${0.07 * fs}px ${COL(q.glow === true ? "red" : q.glow)}`;
  t.fs = fs;
  return t;
}
function enterText(X, t, p, at) {
  const kind = p.in || "cut", d = p.d ?? 0.2, el = t.el, box = t.box;
  const hideUntil = (until) => visTo(X, box, at, until);
  switch (kind) {
    case "slam": {
      TRK(X, el, "transform", `scale(${p.from ?? 1.3})`).to(at, d, "scale(1)", EASE_OUT);
      blurPass(TRK(X, el, "filter", "none", true), at, Math.min(0.2, d), p.axis || (X.r() < 0.5 ? "x" : "y"));
      hideUntil(p.until); break; }
    case "spread": {
      TRK(X, el, "letterSpacing", `${p.ls0 ?? 0.6}em`).to(at, d, `${p.ls ?? 0.01}em`, EASE_OUT);
      TRK(X, box, "opacity", "0").to(at, Math.min(0.12, d), p.op != null ? String(p.op) : "1");
      hideUntil(p.until); break; }
    case "fade": { TRK(X, box, "opacity", "0").to(at, d, p.op != null ? String(p.op) : "1", EASE_IO); hideUntil(p.until); break; }
    case "wipe": {
      const f = p.dir === "R" ? ["inset(0% 0% 0% 100%)", "inset(0% 0% 0% 0%)"] : p.dir === "U" ? ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"] : p.dir === "D" ? ["inset(0% 0% 100% 0%)", "inset(0% 0% 0% 0%)"] : ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)"];
      TRK(X, el, "clipPath", f[0]).to(at, d, f[1], EASE_OUT); hideUntil(p.until); break; }
    case "rise": {
      TRK(X, el, "transform", `translateY(${(p.dy ?? 0.35) * 100}%)`).to(at, d, "translateY(0%)", EASE_OUT);
      TRK(X, box, "opacity", "0").to(at, d * 0.6, "1"); hideUntil(p.until); break; }
    case "words": {
      const wt = p.wt || t.words.map((_, i) => at + i * (p.step ?? 0.18));
      t.words.forEach((w, i) => visTo(X, w, wt[i] ?? at, p.until)); break; }
    case "chars": {
      t.chars.forEach((c, i) => visTo(X, c, at + i * (p.step ?? 0.04), p.until)); break; }
    case "scatter": {
      t.chars.forEach((c, i) => {
        const a = at + i * (p.step ?? 0.02), R = 0.5 * X.W;
        TRK(X, c, "transform", `translate(${rnd(X, 0.18 * X.W)}px, ${rnd(X, 0.25 * X.H)}px) scale(${1.4 + X.r()})`).to(a, d, "translate(0px, 0px) scale(1)", EASE_OUT);
        TRK(X, c, "opacity", "0").to(a, d * 0.6, "1");
        blurPass(TRK(X, c, "filter", "none", true), a, d * 0.8, X.r() < 0.5 ? "x" : "y");
      });
      hideUntil(p.until); break; }
    case "glitch": {
      const j = 0.035 * X.W;
      TRK(X, el, "transform", `translateX(${-j}px)`).set(at + 0.04, `translateX(${j}px)`).set(at + 0.08, `translateX(${-j * 0.5}px)`).set(at + 0.12, "translateX(0px)");
      blurPass(TRK(X, el, "filter", "none", true), at, 0.14, "x");
      hideUntil(p.until); break; }
    default: hideUntil(p.until);
  }
}
function exitText(X, t, p, o) {
  if (!o) return;
  const at = o.at, d = o.d ?? 0.18, box = t.box, el = t.el;
  switch (o.fx || "cut") {
    case "fade": TRK(X, box, "opacity", p.op != null ? String(p.op) : "1").to(at, d, "0", EASE_IO); visTo(X, box, p.at ?? 0, at + d); break;
    case "smear": {
      blurPass(TRK(X, el, "filter", "none", true), at, d, "x");
      TRK(X, box, "opacity", "1").to(at + d * 0.4, d * 0.6, "0");
      TRK(X, el, "transform", "translateX(0px)").to(at, d, `translateX(${(o.dx ?? 0.05) * X.W}px)`, EASE_IN);
      visTo(X, box, p.at ?? 0, at + d); break; }
    default: visTo(X, box, p.at ?? 0, at);
  }
}
/* textos de intro/outro: la pieza marcada toma el texto de config.intro / config.outro */
function slotText(q) {
  if (q.intro && introOn() && String(C.intro[q.intro] || "").trim()) return C.intro[q.intro];
  if (q.outro && String((C.outro || {})[q.outro] || "").trim()) return C.outro[q.outro];
  return q.s;
}
const introOn = () => C.intro && C.intro.enabled !== false && !!String(C.intro.title || "").trim();
const PIECE = {};
PIECE.text = (X, L, p0) => {
  const at = p0.at ?? 0;
  /* la pieza se va del todo: ecos y fantasma se van con ella (salida o until) */
  const gone = p0.until ?? (p0.out ? p0.out.at + (p0.out.d ?? 0.18) : undefined);
  const p = gone != null ? { ...p0, until: gone } : p0;
  if (p.ghost) {
    const g = p.ghost, gt = textOf(X, L, p, { color: g.color || "red", distress: false, glow: false, op: g.op ?? 0.55, ls: p.ls });
    gt.el.style.filter = `url(#mbx${g.blur ?? 2})`;
    const dx = (g.dx ?? 0.04) * X.W;
    TRK(X, gt.el, "transform", `translateX(${dx}px)`).to(at, (p.until ?? X.dur) - at, `translateX(${dx * 0.3}px)`);
    visTo(X, gt.box, at + (g.delay || 0), p.until);
  }
  echoes(X, L, p, at);
  const t = textOf(X, L, p);
  if (p.id) X.ids[p.id] = t;
  enterText(X, t, p, at);
  if (p.boil !== false) boil(X, t.box, { at: 0, until: X.dur + 0.05, amp: p.boil ?? 1, sc: p.font === "th" ? 0.004 : 0.012 });
  if (p.distress !== false && p.erode !== false) erode(X, t.el, { size: p.erodeSize ?? Math.max(0.16, (t.fs / X.H) * 1.4) });   /* el tamaño de la erosión acompaña a la letra (sin trama repetida visible) */
  if (p.weight) { const w = p.weight; TRK(X, t.el, "fontWeight", String(w.from)).to(at + (w.delay || 0), w.d ?? 0.4, String(w.to), EASE_OUT); }
  if (p.ls2 != null) TRK(X, t.el, "letterSpacing", `${p.ls ?? 0.01}em`).to(p.ls2at ?? at, p.ls2d ?? 0.4, `${p.ls2}em`, EASE_OUT);
  if (p.scale) { const s = p.scale; TRK(X, t.el, "transform", `scale(${s.from ?? 1})`).to(s.at ?? at, s.d ?? 0.4, `scale(${s.to})`, EASE_OUT); }
  if (p.drift) TRK(X, t.el, "transform", "translateX(0px)").to(at, (p.until ?? X.dur) - at, `translateX(${p.drift * X.W}px)`);
  if (p.move) { const m = p.move, f = { x: p.x ?? 0.5, y: p.y ?? 0.5 };
    if (m.to.x != null) TRK(X, t.box, "left", f.x * X.W + "px").to(m.at ?? at, m.d ?? 0.3, m.to.x * X.W + "px", m.ease || EASE_OUT);
    if (m.to.y != null) TRK(X, t.box, "top", f.y * X.H + "px").to(m.at ?? at, m.d ?? 0.3, m.to.y * X.H + "px", m.ease || EASE_OUT); }
  if (p.grow) { const g = p.grow; t.words.forEach((w, i) => { const a = g.at[i] ?? g.at[g.at.length - 1], dd = g.d ?? 0.2;
      TRK(X, w, "fontFamily", "var(--fTh)", true).set(a, "var(--fCd)");
      TRK(X, w, "fontSize", `${g.from ?? 0.45}em`).to(a, dd, "1em", EASE_OUT);
      TRK(X, w, "letterSpacing", `${g.ls0 ?? 0.35}em`).to(a, dd, `${p.ls ?? 0.01}em`, EASE_OUT); }); }
  /* palabras repartidas en diagonal que se juntan en la línea (apertura de la referencia) */
  if (p.gather && t.words) { const g = p.gather, mid = (t.words.length - 1) / 2;
    t.words.forEach((w, i) => TRK(X, w, "transform", `translate(${(g.dx ?? 0.06) * (i - mid) * X.W}px, ${(g.dy ?? 0.12) * (i - mid) * X.H}px)`).to(g.at ?? at, g.d ?? 0.3, "translate(0px, 0px)", EASE_OUT)); }
  exitText(X, t, p0, p0.out);
  return t;
};
PIECE.stack = (X, L, p) => {
  const n = p.n ?? 4, cols = p.colors || ["white"], dy = (p.dy ?? 0.15), y0 = (p.y ?? 0.5) - (n - 1) * dy / 2;
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const sc = p.scales ? p.scales[i % p.scales.length] : 1;
    PIECE.text(X, L, { ...p, k: "text", y: y0 + i * dy, color: cols[i % cols.length], fs: p.fs != null ? p.fs * sc : undefined, w: p.w != null ? p.w * (p.fitScale ? sc : 1) : undefined, at: (p.at ?? 0) + i * (p.step ?? 0.05), ghost: i === Math.round(mid) ? p.ghost : undefined, out: p.out ? { ...p.out, at: p.out.at + i * (p.out.step ?? 0) } : undefined });
  }
};
PIECE.grid = (X, L, p) => {
  const cols = p.cols ?? 3, rows = p.rows ?? 3, cw = (p.w ?? 1) * X.W / cols, rh = (p.h ?? 1) * X.H / rows, x0 = p.x0 ?? 0, y0 = p.y0 ?? 0;
  const col = p.colors || ["white"];
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, k++) {
    const sx = p.stagger?.dir === "col" ? c : p.stagger?.dir === "row" ? r : k;
    PIECE.text(X, L, { ...p, k: "text", s: p.s, x: x0 + (c + 0.5) * cw / X.W, y: y0 + (r + 0.5) * rh / X.H, w: cw * (p.fillW ?? 0.9) / X.W, h: rh * (p.fillH ?? 0.8) / X.H, color: col[(r * (p.shift ?? 1) + c) % col.length], at: (p.at ?? 0) + sx * (p.step ?? 0.035), ghost: undefined, out: p.out });
  }
};
PIECE.chalk = (X, L, p) => {
  const at = p.at ?? 0;
  const run = b => {
    const f = SHAPE[p.shape]; if (!f) { console.warn(`[${NAME}] forma desconocida`, p.shape); return; }
    const base = f(b, X, p), o = { color: p.color || "chalk", sw: p.sw ?? 5, at, d: p.d ?? 0.35, step: p.step, until: p.until ?? (p.erase ? p.erase.at + (p.erase.d ?? 0.25) + 0.4 : undefined), op: p.op, rough: p.rough, erase: p.erase };
    if (!(FX.boil > 0) || p.boil === false) { strokes(X, L, base, o); return; }
    const amp = (p.jit ?? 2.6) * X.u * (C.strokeScale ?? 2.3) * 0.6, sd = Math.floor(X.r() * 1e6);
    const vs = [0, 1, 2].map(i => strokes(X, L, i ? base.map((d0, j) => jitterPath(d0, amp, sd + i * 97 + j)) : base, o));
    cycle(X, vs, { op: p.op ?? 1 });
    if (p.erode !== false) vs.forEach(v => erode(X, v, { size: 0.12 }));
  };
  if (p.ref) { const t = X.ids[p.ref]; if (!t) { console.warn(`[${NAME}] ref sin texto`, p.ref); return; } later(X, t, b => run({ x: b.x + (p.bx || 0) * X.W, y: b.y + (p.by || 0) * X.H, w: b.w * (p.bw ?? 1), h: b.h * (p.bh ?? 1) })); }
  else run(absBox(X, p.box || { x: p.x ?? 0.5, y: p.y ?? 0.5, w: p.w ?? 0, h: p.h ?? 0 }));
};
PIECE.rect = (X, L, p) => {
  const { W, H } = X, el = div(L, "patch", { left: p.x * W + "px", top: p.y * H + "px", width: p.w * W + "px", height: p.h * H + "px", background: COL(p.color || "red"), opacity: p.op ?? 1 });
  if (p.blur) el.style.filter = `url(#mb${p.axis || "x"}${p.blur})`;
  if (p.blend) el.style.mixBlendMode = p.blend;
  if (p.z != null) el.style.zIndex = p.z;
  const at = p.at ?? 0;
  if (p.fade) TRK(X, el, "opacity", "0").to(at, p.fade, String(p.op ?? 1), EASE_OUT);
  if (p.drift) TRK(X, el, "transform", "translateX(0px)").to(at, (p.until ?? X.dur) - at, `translateX(${p.drift * W}px)`);
  visTo(X, el, at, p.until);
};
PIECE.paper = (X, L, p) => {
  const { W, H, r } = X, x0 = p.x * W, x1 = (p.x + p.w) * W, y0 = p.y * H, y1 = (p.y + p.h) * H, n = 40, jg = (p.j ?? 0.04) * H;
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; top.push([x, y0 + r() * jg]); bot.push([x, y1 - r() * jg]); }
  const el = div(L, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: COL(p.color || "paper"), clipPath: `polygon(${[...top, ...bot.reverse()].map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})` });
  div(el, "lay", { backgroundImage: GRAIN, opacity: 0.2 });
  const at = p.at ?? 0;
  if (p.grow) TRK(X, el, "transform", "scaleY(0)").to(at, p.grow, "scaleY(1)", EASE_OUT);
  visTo(X, el, at, p.until);
};
/* corte "scan": franjas horizontales del propio cuadro desplazadas a los lados (filtro SVG
   aplicado a toda la escena: metraje y letra se corren juntos), con estela desenfocada */
const SCAN = {};
function scanFilter(X, k) {
  const id = `scan${Math.round(X.W)}_${k}`;
  if (SCAN[id]) return id;
  SCAN[id] = 1;
  const steps = ["0.5 0.5 0.15 0.5 0.85 0.5 0.5 0.3 0.5 0.5 0.95 0.5", "0.5 0.8 0.5 0.5 0.2 0.5 0.5 0.5 0.7 0.5 0.05 0.5", "0.5 0.5 0.5 0.9 0.5 0.35 0.5 0.5 0.1 0.5 0.5 0.65"][k % 3];
  fx.insertAdjacentHTML("beforeend", `<filter id="${id}" x="-20%" y="0%" width="140%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0 ${(0.008 + k * 0.004).toFixed(4)}" numOctaves="1" seed="${11 + k * 7}" result="t"/>
    <feComponentTransfer in="t" result="m"><feFuncR type="discrete" tableValues="${steps}"/><feFuncG type="table" tableValues="0.5 0.5"/></feComponentTransfer>
    <feDisplacementMap in="SourceGraphic" in2="m" scale="${(0.22 * X.W).toFixed(0)}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${(0.006 * X.W).toFixed(1)} 0" result="b"/>
    <feBlend in="d" in2="b" mode="lighten"/></filter>`);
  return id;
}
PIECE.glitch = (X, L, p) => {
  const at = p.at ?? 0, d = p.d ?? 0.25, n = Math.max(2, Math.min(4, Math.round((p.n ?? 6) / 2)));
  const tr = TRK(X, L, "filter", "none", true);
  for (let i = 0; i < n; i++) tr.set(at + d * i / n, `url(#${scanFilter(X, (Math.floor(X.r() * 3) + i) % 3)})`);
  tr.set(at + d, "none");
  /* estela roja tenue: el rojo de la letra arrastrado por el corte */
  if ((p.redP ?? 0.4) > 0.05) {
    const g = div(L, "lay", { zIndex: 30, pointerEvents: "none" });
    for (let i = 0; i < 2; i++) {
      const y = (p.y0 ?? 0.2) + X.r() * ((p.y1 ?? 0.8) - (p.y0 ?? 0.2)), hh = (0.01 + X.r() * 0.025) * X.H;
      const b = div(g, "patch", { left: -0.1 * X.W + "px", top: y * X.H + "px", width: 1.2 * X.W + "px", height: hh + "px", background: P.red, opacity: 0.35 * (p.redP ?? 0.4) + 0.15, filter: "url(#mbx3)" });
      TRK(X, b, "transform", `translateX(${rnd(X, 0.3 * X.W)}px)`).to(at, d, `translateX(${rnd(X, 0.3 * X.W)}px)`);
    }
    visTo(X, g, at, at + d);
  }
};

/* ============ MOVIMIENTO ERRÁTICO · lenguaje del montaje de referencia ============
   La referencia anima "a cuadros": cada 2 cuadros (25 fps) la letra, la tiza y los bordes de
   papel saltan a otra posición/forma (boil de stop-motion); cada palabra lleva ecos desplazados
   y borrosos; el metraje cambia de toma dentro de la misma frase (a veces por un agujero de
   papel rasgado); casi cada cambio pasa por un barrido scan; polvo, rayones y grano parpadean.
   Todo es determinista: tablas de pasos discretos con semilla, nunca Math.random ni tiempo real.
   config.fx = { step, boil, echo, shake, tex, cuts, endScan } (0 apaga cada capa). */
const FX = Object.assign({ step: 0.08, boil: 1, echo: 1, shake: 1, tex: 1, cuts: 1, endScan: 0.55 }, C.fx || {});
const STEP = Math.max(0.04, +FX.step || 0.08);
const hsh = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/* pasos de temblor sobre las propiedades CSS individuales (translate/rotate/scale): no pisan
   las transformaciones de entrada, que van en `transform` */
function boil(X, el, o = {}) {
  const k0 = +(o.amp ?? 1) * FX.boil; if (!(k0 > 0)) return;
  const t0 = Math.max(0, o.at ?? 0), t1 = Math.min(X.dur + 0.05, o.until ?? X.dur + 0.05), seed = (o.seed ?? Math.floor(X.r() * 1e6)) | 0;
  const ax = (o.tx ?? 0.0024) * X.W * k0, ay = (o.ty ?? 0.0032) * X.H * k0, ar = (o.rot ?? 0.5) * k0, as = (o.sc ?? 0.012) * k0;
  const tr = X.T(el, "translate", "0px 0px", true), rt = X.T(el, "rotate", "0deg", true), sc = as > 0 ? X.T(el, "scale", "1", true) : null;
  const st = o.step ?? STEP;
  for (let k = 0, t = t0; t < t1; k++, t += st) {
    tr.set(t, `${((hsh(seed, k * 4) - 0.5) * 2 * ax).toFixed(1)}px ${((hsh(seed, k * 4 + 1) - 0.5) * 2 * ay).toFixed(1)}px`);
    rt.set(t, `${((hsh(seed, k * 4 + 2) - 0.5) * 2 * ar).toFixed(2)}deg`);
    if (sc) sc.set(t, (1 + (hsh(seed, k * 4 + 3) - 0.5) * 2 * as).toFixed(4));
  }
}
/* ecos: copias detrás de la palabra, desplazadas y desenfocadas, que saltan por su cuenta */
function echoes(X, L, p, at) {
  const e = p.echo === false ? null : { n: 2, dx: 0.014, op: 0.32, ...(typeof p.echo === "object" ? p.echo : {}) };
  if (!e || !(FX.echo > 0) || p.font === "th") return;
  const red = (p.color || "white") === "red";
  for (let i = 0; i < e.n; i++) {
    const g = textOf(X, L, p, { color: e.color || (red ? "red" : i ? "red" : "white"), distress: false, glow: false, op: (e.op / (i + 1)) * FX.echo });
    g.el.style.filter = `url(#mbx${i ? 3 : 2})`;
    boil(X, g.box, { at, until: p.until, tx: e.dx * (1 + i), ty: 0.006 * (1 + i), rot: 0.8, sc: 0.03, amp: 1 });
    visTo(X, g.box, at + 0.04 * (i + 1), p.until);
    if (p.in === "words" && g.words && p.wt) g.words.forEach((w, j) => visTo(X, w, p.wt[j] ?? at, p.until));
  }
}
/* erosión de fotocopia: vetas verticales y motas que comen la letra; la máscara salta de
   posición cada paso, así la erosión cambia por cuadros como en la referencia */
const ERODE = (() => {
  const cv = doc.createElement("canvas"); cv.width = cv.height = 256; const cx = cv.getContext("2d");
  cx.fillStyle = "#000"; cx.fillRect(0, 0, 256, 256); cx.globalCompositeOperation = "destination-out";
  let k = 0; const R = () => hsh(4242, k++);
  for (let i = 0; i < 520; i++) { cx.fillStyle = `rgba(0,0,0,${0.45 + R() * 0.55})`; const x = R() * 256, y = R() * 256; cx.fillRect(x, y, 0.7 + R() * 1.6, 3 + R() * 34); }
  for (let i = 0; i < 1400; i++) { cx.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.7})`; const sz = 0.5 + R() * 1.8; cx.fillRect(R() * 256, R() * 256, sz, sz); }
  for (let i = 0; i < 6; i++) { cx.fillStyle = `rgba(0,0,0,${0.5 + R() * 0.4})`; cx.fillRect(0, R() * 256, 256, 0.6 + R() * 1.5); }
  return `url(${cv.toDataURL()})`;
})();
function erode(X, el, o = {}) {
  const sz = Math.round((o.size ?? 0.16) * X.H);
  Object.assign(el.style, { webkitMaskImage: ERODE, maskImage: ERODE, webkitMaskSize: `${sz}px ${sz}px`, maskSize: `${sz}px ${sz}px` });
  if (!(FX.boil > 0)) return;
  const tr = X.T(el, "webkitMaskPosition", "0px 0px", true), tr2 = X.T(el, "maskPosition", "0px 0px", true), seed = Math.floor(X.r() * 1e6);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) { const v = `${Math.floor(hsh(seed, k * 2) * sz)}px ${Math.floor(hsh(seed, k * 2 + 1) * sz)}px`; tr.set(t, v); tr2.set(t, v); }
}
/* variantes de un trazo: mismos puntos con otra rugosidad (para alternarlas) */
function jitterPath(d, amp, seed) { let k = 0; return d.replace(/-?\d+(\.\d+)?/g, m => (parseFloat(m) + (hsh(seed, k++) - 0.5) * 2 * amp).toFixed(1)); }
/* alterna N elementos: solo uno visible por paso (opacidad discreta) */
function cycle(X, els, o = {}) {
  const st = o.step ?? STEP, t0 = Math.max(0, o.at ?? 0), t1 = Math.min(X.dur + 0.05, o.until ?? X.dur + 0.05), seed = (o.seed ?? Math.floor(X.r() * 1e6)) | 0;
  const trs = els.map((el, i) => X.T(el, "opacity", i === 0 ? String(o.op ?? 1) : "0", true));
  let prev = 0;
  for (let k = 0, t = t0; t < t1; k++, t += st) {
    let n = Math.floor(hsh(seed, k) * els.length); if (n === prev && els.length > 1) n = (n + 1) % els.length;
    trs.forEach((tr, i) => tr.set(t, i === n ? String(o.op ?? 1) : "0")); prev = n;
  }
}
/* texturas que parpadean: polvo, pelos y rayones verticales (6 cuadros pregenerados) */
const DUST = (() => {
  const out = [], W = 640, H = 360;
  for (let f = 0; f < 6; f++) {
    const cv = doc.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d");
    const R = (k) => hsh(9001 + f, k);
    let k = 0;
    for (let i = 0; i < 26; i++) { const x = R(k++) * W, y = R(k++) * H, s = 0.4 + R(k++) * 1.1; cx.fillStyle = R(k++) < 0.6 ? `rgba(255,255,255,${0.35 + R(k++) * 0.5})` : `rgba(0,0,0,${0.4 + R(k++) * 0.5})`; cx.beginPath(); cx.arc(x, y, s, 0, 7); cx.fill(); }
    for (let i = 0; i < (f % 3 === 0 ? 1 : 0); i++) { cx.strokeStyle = `rgba(255,255,255,${0.12 + R(k++) * 0.25})`; cx.lineWidth = 0.6 + R(k++); const x = R(k++) * W; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + (R(k++) - 0.5) * 8, H); cx.stroke(); }
    for (let i = 0; i < 2; i++) { cx.strokeStyle = `rgba(${R(k++) < 0.5 ? "255,255,255" : "0,0,0"},${0.4 + R(k++) * 0.4})`; cx.lineWidth = 0.8; const x = R(k++) * W, y = R(k++) * H; cx.beginPath(); cx.moveTo(x, y); cx.bezierCurveTo(x + 10, y + 6, x - 4, y + 14, x + 8 + R(k++) * 10, y + 20); cx.stroke(); }
    out.push(`url(${cv.toDataURL()})`);
  }
  return out;
})();
function textures(X, L) {
  if (!(FX.tex > 0)) return;
  const d = div(L, "lay", { zIndex: 45, pointerEvents: "none", backgroundSize: "100% 100%", mixBlendMode: "normal", opacity: String(0.85 * FX.tex) });
  const tr = X.T(d, "backgroundImage", DUST[0], true), seed = Math.floor(X.r() * 1e6);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) tr.set(t, DUST[Math.floor(hsh(seed, k) * DUST.length)]);
  const g = div(L, "lay", { zIndex: 44, pointerEvents: "none", backgroundImage: GRAIN, backgroundSize: "96px 96px", opacity: String(0.42 * FX.tex), mixBlendMode: "overlay" });
  const gp = X.T(g, "backgroundPosition", "0px 0px", true);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) gp.set(t, `${Math.floor(hsh(seed + 7, k) * 96)}px ${Math.floor(hsh(seed + 11, k) * 96)}px`);
  /* parpadeo de exposición del metraje (luz que respira por cuadros) */
  const fl = div(L, "lay", { zIndex: 43, pointerEvents: "none", background: "#000" });
  const ft = X.T(fl, "opacity", "0", true);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) ft.set(t, (hsh(seed + 3, k) * 0.12).toFixed(3));
}
/* cámara: temblor fino continuo y golpe al entrar en la escena */
function shake(X, G, d = {}) {
  if (!(FX.shake > 0)) return;
  const seed = Math.floor(X.r() * 1e6), base = (d.shake ?? 1) * FX.shake, hit = (d.hit ?? 0.5) * FX.shake;
  const tr = X.T(G, "translate", "0px 0px", true), sc = X.T(G, "scale", "1", true);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) {
    const h = t < 0.2 ? hit * (1 - t / 0.2) : 0, ax = (0.0025 * base + 0.018 * h) * X.W, ay = (0.003 * base + 0.02 * h) * X.H;
    tr.set(t, `${((hsh(seed, k * 2) - 0.5) * 2 * ax).toFixed(1)}px ${((hsh(seed, k * 2 + 1) - 0.5) * 2 * ay).toFixed(1)}px`);
    sc.set(t, (1 + 0.06 * h + (hsh(seed, k * 3 + 9) - 0.5) * 0.006 * base).toFixed(4));
  }
}
/* cortes de toma dentro de la escena: otra toma (otro clip, otro punto, otro encuadre), a veces
   revelada por un agujero de papel rasgado que se abre en dos cuadros */
const CLIPS = () => (C.media || []).map(m => m.id);
function tornHole(W, H, seed, f) {
  const cx = (0.25 + hsh(seed, 1) * 0.5) * W, cy = (0.3 + hsh(seed, 2) * 0.4) * H, rx = (0.35 + 0.65 * f) * W * 0.75, ry = (0.35 + 0.65 * f) * H * 0.85, pts = [];
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, k = 0.78 + hsh(seed, 10 + i) * 0.32; pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)}px ${(cy + Math.sin(a) * ry * k).toFixed(1)}px`); }
  return `polygon(${pts.join(", ")})`;
}
function bgCuts(X, L, d) {
  if (!(FX.cuts > 0) || d.light || d.paper || d.clip == null || d.cuts === false) return;
  const list = Array.isArray(d.cuts) ? d.cuts : (C.bgCuts || []).map(t => ({ t: t - TOFF - X.sc.t0 })).filter(c => c.t > 0.12 && c.t < X.dur - 0.1);
  const ids = CLIPS(); if (ids.length < 2) return;
  const cur = typeof d.clip === "string" ? d.clip : ids[d.clip % ids.length];
  let prevBox = null;
  list.forEach((c, i) => {
    const at = c.t ?? c.at, seed = Math.floor(hsh(Math.round((X.sc.t0 + at) * 100), 77) * 1e6);
    const id = c.clip ?? ids[(ids.indexOf(cur) + 1 + Math.floor(hsh(seed, 3) * (ids.length - 1))) % ids.length];
    const spec = (C.media || []).find(m => m.id === id) || 0;
    const box = mbox(X, L, spec, { left: 0, top: 0, width: X.W + "px", height: X.H + "px" }, { filter: d.grade === undefined ? "bw" : d.grade, off: c.off ?? hsh(seed, 4) * 6 });
    const z = c.zoom ?? 1.04 + hsh(seed, 5) * 0.35;
    box.el.style.transform = `scale(${z.toFixed(3)})${hsh(seed, 6) < 0.3 ? " scaleX(-1)" : ""}`;
    box.el.style.objectPosition = `${(hsh(seed, 7) * 100).toFixed(0)}% ${(30 + hsh(seed, 8) * 40).toFixed(0)}%`;
    if (L.children[1]) L.insertBefore(box.box, L.children[1 + i]); /* debajo de niebla, viñeta, bordes y letra */
    box.box.style.visibility = "hidden"; visTo(X, box.box, at, c.until);
    if ((c.tear ?? (hsh(seed, 9) < 0.45))) {
      const cp = X.T(box.box, "clipPath", tornHole(X.W, X.H, seed, 0.25), true);
      cp.set(at + STEP, tornHole(X.W, X.H, seed, 0.6)).set(at + STEP * 2, "none");
    }
    prevBox = box;
  });
}
/* barrido scan corto al final de la escena (la mayoría de los cortes de la referencia) */
function endScan(X, L, d) {
  const p = d.endScan ?? FX.endScan;
  if (!(p > 0) || X.dur < 0.5 || X.sc.kind === "outro") return;
  if (hsh(Math.round(X.sc.t0 * 100), 5) > p) return;
  PIECE.glitch(X, L, { at: X.dur - 0.12, d: 0.12, n: 4, redP: 0.5 });
}
/* bordes de papel que tiemblan: 3 recortes alternados */
function boilEdges(X, L) {
  if (!(FX.boil > 0)) return;
  for (const patch of L.querySelectorAll(":scope > .patch[data-edge]")) {
    const vs = JSON.parse(patch.dataset.edge); if (vs.length < 2) continue;
    const tr = X.T(patch, "clipPath", vs[0], true), seed = Math.floor(X.r() * 1e6);
    for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP * 1.5) tr.set(t, vs[Math.floor(hsh(seed, k) * vs.length)]);
  }
}

/* ---------------- escena dirigida ---------------- */
const shiftTimes = (o, dt) => {
  if (Array.isArray(o)) return o.map(v => shiftTimes(v, dt));
  if (!o || typeof o !== "object") return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (["at", "until", "ls2at", "delay"].includes(k) && typeof v === "number") out[k] = v + dt;
    else if (k === "wt" && Array.isArray(v)) out[k] = v.map(x => x + dt);
    else if (k === "at" && Array.isArray(v)) out[k] = v.map(x => x + dt);
    else if (typeof v === "object") out[k] = shiftTimes(v, dt);
    else out[k] = v;
  }
  return out;
};
const expandPieces = d => {
  const out = [];
  for (const u of d.use || []) {
    const ps = (C.defs && C.defs[u.def]) || [];
    for (const p of ps) { let q = shiftTimes(p, u.dt || 0); if (u.set) q = { ...q, ...u.set }; if (u.ids) q = { ...q, id: q.id && u.ids ? q.id : q.id }; out.push(q); }
  }
  return out.concat(d.pieces || []);
};
const fromEnd = (o, dur) => {
  if (Array.isArray(o)) return o.map(v => fromEnd(v, dur));
  if (!o || typeof o !== "object") return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = (["at", "until"].includes(k) && typeof v === "number" && v < 0) ? Math.max(0, dur + v) : typeof v === "object" ? fromEnd(v, dur) : v;
  return out;
};
B.compose = (sc, X) => {
  const d = sc.def, bg = d.bg || {}, L = bgScene(X, bg);
  X.ids = {};
  bgCuts(X, L, bg);
  boilEdges(X, L);
  const G = div(L, "lay", { zIndex: 20 });   /* letra y tiza: tiemblan juntas sobre el metraje */
  for (const p0 of expandPieces(d)) {
    const p = fromEnd(p0, X.dur);
    const f = PIECE[p.k || "text"];
    if (!f) { console.warn(`[${NAME}] pieza desconocida`, p.k); continue; }
    try { f(X, p.k === "glitch" || p.k === "paper" && p.under ? L : G, p); } catch (e) { console.warn(`[${NAME}] pieza fallo`, p.k, e); }
  }
  shake(X, G, d.fx || {});
  textures(X, L);
  endScan(X, L, d);
};
/* outro elegido: config.outro.version (v1|v2) o ?outro=v1|v2 en la URL */
const outroVersion = () => { const q = QS.get("outro"); return q === "v1" || q === "v2" ? q : (C.outro && C.outro.version === "v2" ? "v2" : "v1"); };
const outroOn = () => C.outro && C.outro.enabled !== false && C.outroDesigns && C.outroDesigns[outroVersion()];
/* entrada de la línea de tiempo → escena. type "intro": la escena de apertura con el título;
   type "outro": se sustituye por config.outroDesigns[v1|v2] (si el outro está apagado se
   dibujan las piezas propias de la entrada). */
function sceneOf(s, i, t0, t1) {
  let def = s, kind = "lyric";
  if (s.type === "intro" && introOn()) kind = "intro";
  if (s.type === "outro" && outroOn()) { def = { ...C.outroDesigns[outroVersion()], name: s.name }; kind = "outro"; }
  return { idx: i, t0, t1: Math.max(t0 + 0.05, t1), dur: Math.max(0.05, t1 - t0), kind, seg: { text: s.name || "" }, words: [], type: "compose", def,
           slot: { type: "compose", media: def.bg && def.bg.clip != null ? [def.bg.clip] : [], trans: s.tr } };
}
function explicitTimeline(dur) {
  const T = C.timeline;
  return T.map((s, i) => {
    const t0 = i === 0 ? 0 : Math.max(0, s.t0 - TOFF);
    const next = T[i + 1];
    const t1 = Math.min(dur, (s.t1 ?? (next ? next.t0 : dur + TOFF)) - TOFF);
    return sceneOf(s, i, t0, t1);
  });
}
/* galería: ?only=<componente> monta una sola escena desde 0 (ver showcase/components.json) */
function onlyTimeline(only, dur) {
  let p = {}; try { p = JSON.parse(QS.get("p") || "{}") || {}; } catch (e) { console.warn(`[${NAME}] p inválido`); }
  const T = C.timeline || [], short = only.replace(/^grunge-montage\./, "");
  for (const k of ["title", "artist"]) if (typeof p[k] === "string") { C.intro[k] = p[k]; C.intro.enabled = true; }
  for (const k of ["title", "sub", "feats"]) if (typeof p[k] === "string") C.outro[k] = p[k];
  let src;
  if (short === "intro") { src = T.find(s => s.type === "intro"); if (!String(C.intro.title || "").trim()) C.intro.title = "Título de la canción"; }
  else if (short === "outrov1" || short === "outrov2") { C.outro.version = short.slice(-2); C.outro.enabled = true; src = T.find(s => s.type === "outro") || { type: "outro", t0: 0, t1: 4 }; }
  else src = T.find(s => s.name === (p.scene || "s10")) || T[0];
  if (!src) return [];
  const len = Math.min(dur, p.duration ?? ((src.t1 ?? src.t0 + 3) - src.t0));
  return [sceneOf(src, 0, 0, len)];
}
function makeTimeline(segs, dur) {
  if (QS.get("only")) return onlyTimeline(QS.get("only"), dur);
  return C.timeline && C.timeline.length ? explicitTimeline(dur) : lyricTimeline(segs, dur, FITS);
}
B.intro = B.slam;
B.outro = B.slam;

boot();
