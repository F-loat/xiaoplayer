interface Lyric {
  time: number;
  lrc: string;
}

export function parse(lrcContent: string): Lyric[] {
  return lrcContent
    .split('\n')
    .map((line) => {
      const trimmedLine = line.trim();
      const timeMatch = trimmedLine.match(/\[\d{2}:\d{2}(\.\d{2})?\](.*)/);
      if (timeMatch) {
        const timeStr = timeMatch[0].match(/\[(\d{2}):(\d{2})(\.\d{2})?\]/);
        if (timeStr) {
          let timeMs =
            parseInt(timeStr[1], 10) * 60000 + parseInt(timeStr[2], 10) * 1000;
          if (timeStr[3]) {
            timeMs += parseFloat(timeStr[3]) * 1000;
          }
          const lrcText = timeMatch[2].trim();
          return { time: timeMs, lrc: lrcText } as Lyric;
        }
      }
      return null;
    })
    .filter((item): item is Lyric => !!item?.lrc);
}
