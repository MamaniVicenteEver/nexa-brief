"""Catálogo compartido; medidas orientativas, no réplicas de clases históricas."""

SPECS = {
    "carrier-super": dict(family="carrier", variant="supercarrier", length_m=332, relative_length=1.0, aircraft=12),
    "carrier-super-empty": dict(family="carrier", variant="supercarrier-empty", length_m=332, relative_length=1.0, aircraft=0),
    "carrier-stovl": dict(family="carrier", variant="stovl", length_m=244, relative_length=244/332, aircraft=6),
    "warship-destroyer": dict(family="warship", variant="destroyer", length_m=149.4, relative_length=.45),
    "warship-frigate": dict(family="warship", variant="frigate", length_m=126.16, relative_length=.38),
    "warship-cruiser": dict(family="warship", variant="cruiser", length_m=172.64, relative_length=.52),
    "cargo-tanker": dict(family="cargo", variant="tanker", length_m=348.6, relative_length=1.05),
    "cargo-container": dict(family="cargo", variant="container", length_m=299, relative_length=299/332),
    "cargo-bulk": dict(family="cargo", variant="bulk", length_m=229, relative_length=229/332),
    "submarine": dict(family="submarine", variant="surfaced", length_m=159.36, relative_length=.48),
    "air-bomber-wing": dict(family="air", variant="bomber-wing", length_m=21, relative_length=21/332, span_m=52),
    "air-bomber-swept": dict(family="air", variant="bomber-swept", length_m=49, relative_length=49/332, span_m=44),
    "air-jet-attack": dict(family="air", variant="jet-attack", length_m=16.7, relative_length=16.7/332, span_m=15.9),
    "air-jet-fighter": dict(family="air", variant="jet-fighter", length_m=19.1, relative_length=19.1/332, span_m=19.5),
    "air-helicopter-body": dict(family="air", variant="helicopter-body", length_m=19.8, relative_length=19.8/332, rotor_diameter_m=18.3),
    "air-helicopter-rotor": dict(family="air", variant="helicopter-rotor", length_m=18.3, relative_length=18.3/332, span_m=18.3),
    "air-prop-transport": dict(family="air", variant="prop-transport", length_m=29.8, relative_length=29.8/332, span_m=40.4),
}

STATES = ("normal", "detected", "burning", "wrecked")
