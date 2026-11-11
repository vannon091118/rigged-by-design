/** Parse agent:new options while preserving commas in scalar arguments. */
export function parseAgentNewArgs(args) {
  const has = (name) => args.includes(`--${name}`);
  const values = (name) => {
    const list = [];
    for (let index = 0; index < args.length; index += 1) {
      const token = args[index];
      if (token === `--${name}`) {
        const next = args[index + 1];
        if (next && !next.startsWith('--')) list.push(next);
      } else if (token.startsWith(`--${name}=`)) {
        list.push(token.slice(name.length + 3));
      }
    }
    return name === 'allow'
      ? list.flatMap((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean))
      : list;
  };
  return { has, values, arg: (name) => values(name)[0] };
}
