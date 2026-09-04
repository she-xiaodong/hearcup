Component({
  properties: {
    provider: {
      type: Object,
      value: {},
      observer(v) {
        // 「H币起」= 15 分钟档价格（H币）：优先用后端 tier15（元），缺失按单价×15 兜底。
        if (v && typeof v.tier15 === 'number' && v.tier15 > 0) {
          this.setData({ priceCoins: getApp().toCoins(v.tier15) })
        } else if (v && typeof v.price_per_minute === 'number') {
          this.setData({ priceCoins: getApp().toCoins(v.price_per_minute * 15) })
        }
      }
    }
  },
  data: { priceCoins: '' },
  methods: {
    onTapCard() {
      wx.navigateTo({ url: `/pages/listener-detail/index?id=${this.data.provider.id}` })
    },
    onCall(e) {
      // 已改为点击卡片进入详情页下单，不再直接呼叫
      this.onTapCard()
    }
  }
})
