"""Orientative original designs; symbolic ground scale, physical naval/air proportions."""

def ground(variant, length, relative):
    return dict(family='ground', variant=variant, length_m=length, relative_length=relative,
                scale_basis='symbolic-ground', physical_relative_length=length/332)

def vessel(variant, length):
    return dict(family='cargo' if variant=='tanker-vlcc' else 'warship',variant=variant,
                length_m=length,relative_length=length/332,scale_basis='physical-332m')

def aircraft(variant,length,span):
    return dict(family='air',variant=variant,length_m=length,span_m=span,
                relative_length=length/332,scale_basis='physical-332m')

SPECS = {
 'tank-main':ground('main-angular',9.8,.10),
 'tank-main-rounded':ground('main-rounded',9.5,.10),
 'tank-light':ground('light',7,.075),
 'apc':ground('wheeled-8x8',7.6,.08),
 'truck-military':ground('canvas-6x6',8.5,.09),
 'truck-fuel':ground('fuel-6x6',9,.095),
 'jeep':ground('utility-4x4',4.5,.055),
 'artillery-towed':ground('towed-howitzer',10,.10),
 'artillery-self-propelled':ground('tracked-howitzer',11.5,.115),
 'missile-launcher':ground('launcher-8x8',12,.12),
 'ambulance-cross':ground('ambulance-red-cross',6,.06),
 'ambulance-crescent':ground('ambulance-red-crescent',6,.06),
 'bulldozer-engineer':ground('tracked-engineer',7,.075),
 'ship-amphibious':vessel('amphibious',250),
 'ship-patrol':vessel('patrol',42),
 'ship-tug':vessel('tug',32),
 'ship-tanker-vlcc':vessel('tanker-vlcc',365),
 'ship-platform':dict(family='site',variant='offshore-platform',length_m=90,relative_length=90/332,scale_basis='physical-332m'),
 'air-bomber-heavy':aircraft('bomber-heavy-four-engine',48,60),
 'air-bomber-tactical':aircraft('bomber-tactical-twin-engine',24,22),
 'air-transport-jet':aircraft('transport-four-jet',53,51),
 'air-fighter-swept':aircraft('fighter-swept',18,12),
 'air-helicopter-heavy':aircraft('helicopter-tandem',30,18),
 'air-uav':aircraft('uav-long-wing',11,20),
}
STATES=('normal','detected','burning','wrecked')
