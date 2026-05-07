<template>
  <div class="info-hero">
    <p class="info-hero__eyebrow">Shopping Guide</p>
    <h1 class="info-hero__title">尺寸指南</h1>
    <div class="info-hero__line"></div>
    <p class="info-hero__sub">找到最適合你的尺寸，讓每件衣服都完美合身</p>
  </div>

  <div class="info-wrap">

    <section class="info-section">
      <h2 class="info-section__title">量身方式</h2>
      <div class="measure-grid">
        <div class="measure-item">
          <div class="measure-item__num">01</div>
          <h4>胸圍</h4>
          <p>將軟尺水平圍繞胸部最豐滿處一圈，確保軟尺保持水平且不過緊。</p>
        </div>
        <div class="measure-item">
          <div class="measure-item__num">02</div>
          <h4>腰圍</h4>
          <p>量取腰部最細處，約在肚臍上方 2~3 公分位置，軟尺保持水平。</p>
        </div>
        <div class="measure-item">
          <div class="measure-item__num">03</div>
          <h4>臀圍</h4>
          <p>站直，軟尺圍繞臀部最豐滿處（一般在腰部下方約 20 公分）測量。</p>
        </div>
        <div class="measure-item">
          <div class="measure-item__num">04</div>
          <h4>肩寬</h4>
          <p>從左肩端點到右肩端點的水平距離，可請他人協助量取。</p>
        </div>
      </div>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">尺寸對照表（上衣 / 洋裝）</h2>
      <p class="note">單位：公分（cm）</p>
      <div class="table-wrap">
        <table class="size-table">
          <thead>
            <tr>
              <th>尺寸</th>
              <th>胸圍</th>
              <th>腰圍</th>
              <th>臀圍</th>
              <th>肩寬</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>S</td><td>82–86</td><td>64–68</td><td>88–92</td><td>37–38</td></tr>
            <tr><td>M</td><td>87–91</td><td>69–73</td><td>93–97</td><td>38–40</td></tr>
            <tr><td>L</td><td>92–96</td><td>74–78</td><td>98–102</td><td>40–42</td></tr>
            <tr><td>XL</td><td>97–102</td><td>79–84</td><td>103–108</td><td>42–44</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">尺寸對照表（下著 / 裙子）</h2>
      <p class="note">單位：公分（cm）</p>
      <div class="table-wrap">
        <table class="size-table">
          <thead>
            <tr>
              <th>尺寸</th>
              <th>腰圍</th>
              <th>臀圍</th>
              <th>裙長（短）</th>
              <th>裙長（長）</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>S</td><td>60–64</td><td>86–90</td><td>40–45</td><td>75–85</td></tr>
            <tr><td>M</td><td>65–69</td><td>91–95</td><td>40–45</td><td>75–85</td></tr>
            <tr><td>L</td><td>70–74</td><td>96–100</td><td>40–45</td><td>75–85</td></tr>
            <tr><td>XL</td><td>75–80</td><td>101–106</td><td>40–45</td><td>75–85</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">選尺寸注意事項</h2>
      <ul class="info-list">
        <li>每件商品詳情頁均附有該商品實際尺寸，建議以實際尺寸為準。</li>
        <li>日韓版型普遍偏亞洲修身，若介於兩個尺寸之間，建議選擇較大尺寸。</li>
        <li>彈性材質（棉彈、雪紡彈）可能有較大的合身範圍，詳見商品說明。</li>
        <li>若量身數據接近尺寸範圍上限，建議加大一碼。</li>
        <li>尺寸因商品版型而異，有任何疑問歡迎透過「聯絡我們」詢問。</li>
      </ul>
    </section>

  </div>
</template>

<style scoped>
.info-hero {
  background: var(--fe-cream);
  padding: 120px 24px 64px;
  text-align: center;
}
.info-hero__eyebrow {
  font-size: 11px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 16px;
}
.info-hero__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(36px, 6vw, 54px);
  font-weight: 400;
  color: var(--fe-text);
  margin: 0 0 20px;
  letter-spacing: 0.04em;
}
.info-hero__line {
  width: 40px;
  height: 1px;
  background: var(--fe-gold);
  margin: 0 auto 20px;
}
.info-hero__sub {
  font-size: 14px;
  color: var(--fe-muted);
  margin: 0;
  line-height: 1.8;
}
.info-wrap {
  max-width: 820px;
  margin: 0 auto;
  padding: 64px 24px 96px;
}
.info-section {
  margin-bottom: 56px;
}
.info-section__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 24px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 24px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--fe-border);
  letter-spacing: 0.04em;
}

/* Measure grid */
.measure-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
@media (max-width: 560px) {
  .measure-grid { grid-template-columns: 1fr; }
}
.measure-item {
  background: var(--fe-cream);
  border: 1px solid var(--fe-border);
  border-radius: 10px;
  padding: 24px;
}
.measure-item__num {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 32px;
  color: var(--fe-gold);
  line-height: 1;
  margin-bottom: 8px;
}
.measure-item h4 {
  font-size: 15px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 8px;
  letter-spacing: 0.04em;
}
.measure-item p {
  font-size: 13.5px;
  color: var(--fe-muted);
  line-height: 1.8;
  margin: 0;
}

/* Table */
.note {
  font-size: 12.5px;
  color: var(--fe-muted);
  margin: 0 0 12px;
  letter-spacing: 0.04em;
}
.table-wrap {
  overflow-x: auto;
}
.size-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.size-table th {
  background: var(--fe-linen);
  color: var(--fe-text);
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 12px 20px;
  text-align: center;
  border: 1px solid var(--fe-border);
}
.size-table td {
  padding: 11px 20px;
  text-align: center;
  border: 1px solid var(--fe-border);
  color: var(--fe-muted);
  font-size: 14px;
}
.size-table tbody tr:hover td {
  background: var(--fe-cream);
}
.size-table td:first-child {
  font-weight: 600;
  color: var(--fe-text);
  background: var(--fe-cream);
}

/* List */
.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.info-list li {
  font-size: 14.5px;
  line-height: 2;
  color: var(--fe-muted);
  padding-left: 20px;
  position: relative;
  margin-bottom: 4px;
}
.info-list li::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--fe-gold);
}
</style>
