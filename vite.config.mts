import { defineConfig } from 'weapp-vite/config';
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite';

export default defineConfig({
  weapp: {
    srcRoot: 'miniprogram',
  },
  plugins: [
    // @ts-ignore
    uvwt({
      rem2rpx: true,
    }),
  ],
});
