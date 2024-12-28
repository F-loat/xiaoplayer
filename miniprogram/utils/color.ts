function isColorSuitableForWhiteText(r: number, g: number, b: number) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 120;
}

function darkenColor(r: number, g: number, b: number, amount = 40) {
  r = Math.max(0, Math.min(255, r - amount));
  g = Math.max(0, Math.min(255, g - amount));
  b = Math.max(0, Math.min(255, b - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function adjustBackgroundForWhiteText(r: number, g: number, b: number) {
  if (isColorSuitableForWhiteText(r, g, b)) {
    return darkenColor(r, g, b);
  } else {
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export function getAverageColor(rgbaValues: number[]) {
  let rSum = 0,
    gSum = 0,
    bSum = 0;
  for (let i = 0; i < rgbaValues.length; i += 4) {
    rSum += rgbaValues[i];
    gSum += rgbaValues[i + 1];
    bSum += rgbaValues[i + 2];
  }
  const rAvg = Math.round(rSum / (rgbaValues.length / 3));
  const gAvg = Math.round(gSum / (rgbaValues.length / 3));
  const bAvg = Math.round(bSum / (rgbaValues.length / 3));
  return adjustBackgroundForWhiteText(rAvg, gAvg, bAvg);
}

export async function getImageColor(url: string) {
  const canvas = wx.createOffscreenCanvas({ type: '2d', width: 3, height: 3 });
  const context = canvas.getContext('2d');
  const image = canvas.createImage();
  await new Promise((resolve) => {
    image.onload = resolve;
    image.src = url;
  });
  context.clearRect(0, 0, 3, 3);
  context.drawImage(image, 0, 0, 3, 3);
  const { data: colors } = context.getImageData(0, 0, 3, 3);
  return getAverageColor(colors);
}
