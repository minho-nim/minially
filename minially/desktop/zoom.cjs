const LEVELS=[.5,.67,.75,.8,.9,1,1.1,1.25,1.5];
function nextZoom(current,action){if(!['in','out','reset'].includes(action))throw new Error('지원하지 않는 화면 배율입니다.');if(action==='reset')return 1;return action==='in'?(LEVELS.find(value=>value>current+.001)??1.5):([...LEVELS].reverse().find(value=>value<current-.001)??.5);}
module.exports={LEVELS,nextZoom};
