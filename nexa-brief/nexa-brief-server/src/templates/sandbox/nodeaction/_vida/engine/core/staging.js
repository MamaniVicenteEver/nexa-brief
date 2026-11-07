import { ACTIONS } from '../act/index.js';

export const headWidth = actor => 2*(actor.character.head?.radius??.166)*actor.pose.scale*(actor.character.height??1);
export const conversationDistance = (a,b,spacing=1.15) => (headWidth(a)+headWidth(b))*.5*(1+spacing);
export function actorPoseAt(scene,id,t) {
  let pose={...scene.actors[id].pose};
  for(const event of scene.events.filter(e=>e.who===id&&['walk','sit','stand','turn'].includes(e.action)&&e.t0<=t))
    pose={...pose,...ACTIONS[event.action].sample(event,Math.min(t-event.t0,event.dur)).pose};
  return pose;
}
export function conversationTarget(scene,who,from,to,t,spacing=1.15) {
  let point=[...to],faceTo;
  // Resolve occupied and nearby anchors using the already planned positions at arrival.
  for(const [id,actor] of Object.entries(scene.actors)) {
    if(id===who)continue;
    const p=actorPoseAt(scene,id,t),distance=conversationDistance(scene.actors[who],actor,spacing);
    if(Math.abs(p.y-to[1])>scene.set.charHeight*.22||Math.abs(point[0]-p.x)>=distance)continue;
    const side=Math.sign(from[0]-p.x)||-1;
    point[0]=p.x+side*distance;faceTo=id;
  }
  return {point,faceTo};
}
