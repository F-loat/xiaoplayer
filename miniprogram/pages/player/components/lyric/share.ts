import { store } from '@/miniprogram/stores';
import { sleep } from '@/miniprogram/utils';

Component({
  methods: {
    getSharePromise(
      from: string,
      message: {
        title: string;
        imageUrl: string;
        path: string;
      },
    ) {
      const promise = new Promise(async (resolve) => {
        if (from !== 'button') {
          resolve(message);
          return;
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const { index: lryicIndex } = store.musicLyricCurrent;
        this.setData({
          sharing: {
            date: `${year}.${month}.${day}`,
            lyrics: [
              store.musicLyric[lryicIndex]?.lrc,
              store.musicLyric[lryicIndex + 1]?.lrc,
              store.musicLyric[lryicIndex + 2]?.lrc,
            ],
          },
        });
        await sleep(200);
        this.createSelectorQuery()
          .select('#poster')
          .node()
          .exec((res) => {
            const node = res[0]?.node;
            if (!node?.takeSnapshot) {
              resolve(message);
              return;
            }
            node.takeSnapshot({
              type: 'file',
              format: 'png',
              success: (res: { tempFilePath: string }) => {
                resolve({
                  ...message,
                  imageUrl: res.tempFilePath,
                });
              },
              fail: () => resolve(message),
            });
          });
      });
      return promise;
    },
  },
});
