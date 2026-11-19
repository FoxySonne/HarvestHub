export function allianceTagError(value,alliances,exceptId=''){
 if(!/^\p{L}{1,3}$/u.test(value))return 'Введите от одной до трёх букв.';
 if(alliances.some(a=>a.id!==exceptId&&a.name===value))return 'Союз с таким названием уже есть.';
 return '';
}
