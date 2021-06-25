<template>
  <div id="main">
    <div id="input">
      <div id="stock">
        股票
        <el-select id="market" v-model="market">
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
      </div>
      <el-input id="code" v-model="code" placeholder="股票代码"></el-input>
      <el-button type="primary" v-on:click="onClick()">获取股票快照</el-button>
      <el-button type="primary" v-on:click="getKL()">获取股票K</el-button>
    </div>
    <span id="err">{{ errMsg }}</span>
    <div id="output">
      <div id="content">
        <div id="myChart" style="width: 80vw; height: 60vw"></div>
        <pre><code class="language-js" v-html="get_message"></code></pre>
      </div>
    </div>
  </div>
</template>

<script>
import "../public/prism.css";
import ftWebsocket from "futu-api";
import beautify from "js-beautify";
import prism from "prismjs";

export default {
  name: "getr",
  data() {
    return {
      errMsg: "",
      market: 21,
      code: "600926",
      upColor: "#00da3c",
      downColor: "#ec0000",
      options: [
        {
          value: 1, //Qot_Common.QotMarket_HK_Security
          label: "HK",
        },
        {
          value: 11, //Qot_Common.QotMarket_US_Security
          label: "US",
        },
        {
          value: 21, //Qot_Common.QotMarket_CNSH_Security
          label: "SH",
        },
        {
          value: 22, //Qot_Common.QotMarket_CNSZ_Security
          label: "SZ",
        },
      ],

      get_message: null,
    };
  },
  created() {},
  destroyed() {},
  mounted() {
    this.getKL();
  },
  methods: {
    onClick() {
      this.errMsg = "";
      let websocket = new ftWebsocket();
      //参数1指定监听地址
      //参数2指定Websocket服务端口
      //参数3指定是否启用SSL，如果需要启用则需要在FutuOpenD配置相关选项
      //参数4指定连接的密钥，否则会连接超时，密钥在在FutuOpenD可配置，UI版本在不指定的情况下会随机指定
      websocket.start(
        this.$store.state.addr,
        this.$store.state.port,
        this.$store.state.enable_ssl,
        this.$store.state.key
      );

      websocket.onlogin = (ret, msg) => {
        if (ret) {
          const req = {
            c2s: {
              securityList: [
                {
                  market: this.market,
                  code: this.code,
                },
              ],
            },
          };
          websocket
            .GetSecuritySnapshot(req)
            .then((res) => {
              let code = beautify(JSON.stringify(res), {
                indent_size: 2,
                space_in_empty_paren: true,
              });
              this.get_message = prism.highlight(
                code,
                Prism.languages.javascript,
                "javascript"
              );
            })
            .catch((error) => {
              this.errMsg = "error: " + msg;
              console.log("error:", error);
            });

          //关闭行情连接，连接不再使用之后，要关闭，否则占用不必要资源
          //同时OpenD也限制了最多128条连接
          //也可以一个页面或者一个项目维护一条连接，这里范例请求一次创建一条连接
          websocket.stop();
        } else {
          this.errMsg = "error: 请检查是否有设置store.js中key字段";
          console.log("error:", msg);
        }
      };
    },
    getKL() {
      if (this.market == "11") {
        this.getUSData();
        return;
      }

      this.errMsg = "";
      let websocket = new ftWebsocket();
      //参数1指定监听地址
      //参数2指定Websocket服务端口
      //参数3指定是否启用SSL，如果需要启用则需要在FutuOpenD配置相关选项
      //参数4指定连接的密钥，否则会连接超时，密钥在在FutuOpenD可配置，UI版本在不指定的情况下会随机指定
      websocket.start(
        this.$store.state.addr,
        this.$store.state.port,
        this.$store.state.enable_ssl,
        this.$store.state.key
      );
      var utc = new Date().toJSON().slice(0, 10).replace(/-/g, "-");
      console.log(utc);
      websocket.onlogin = (ret, msg) => {
        if (ret) {
          const req = {
            c2s: {
              rehabType: 0,
              klType: 2,
              security: {
                market: this.market,
                code: this.code,
              },
              beginTime: "2020-01-01",
              endTime: utc,
            },
          };
          websocket
            .RequestHistoryKL(req)
            .then((res) => {
              console.log(res);
              const datas = this.splitData1(res.s2c.klList);
              this.convertData(res.s2c.klList, datas, res);

              // let code = beautify(JSON.stringify(res), {
              //   indent_size: 2,
              //   space_in_empty_paren: true,
              // });
              // this.get_message = prism.highlight(
              //   code,
              //   Prism.languages.javascript,
              //   "javascript"
              // );
            })
            .catch((error) => {
              this.errMsg = "error: " + msg;
              console.log("error:", error);
            });

          //关闭行情连接，连接不再使用之后，要关闭，否则占用不必要资源
          //同时OpenD也限制了最多128条连接
          //也可以一个页面或者一个项目维护一条连接，这里范例请求一次创建一条连接
          websocket.stop();
        } else {
          this.errMsg = "error: 请检查是否有设置store.js中key字段";
          console.log("error:", msg);
        }
      };
    },
    getUSData() {
      this.$ajax
        .post(`http://coin.wztctech.com/api?type=1&code=${this.code}`)
        .then((resp) => {
          console.log(resp.data.data);
          let datas = resp.data.data.stocks;
          datas.extra = resp.data.data;
          this.drawChart(datas, null);
        })
        .catch((err) => {
          console.log(err);
        });
    },
    convertData(rows, datas, res) {
      this.$ajax
        .post(`http://coin.wztctech.com/api?type=2&code=${this.code}`, {
          rows: rows,
        })
        .then((resp) => {
          console.log(resp.data.data.macd);
          datas.extra = resp.data.data;
          this.drawChart(datas, res);
        })
        .catch((err) => {
          console.log(err);
        });
    },
    getdata() {
      this.$ajax
        .get(
          "https://cdn.jsdelivr.net/gh/apache/echarts-website@asf-site/examples/data/asset/data/stock-DJI.json"
        )
        .then((resp) => {
          const datas = this.splitData(resp.data);

          this.drawChart(datas);
          console.log(datas);
        })
        .catch((err) => {
          console.log(err);
        });
    },
    getMark(data) {
      let buy_lvl1 = data.extra.rik.buy_lvl1;
      let sell_lvl1 = data.extra.rik.sell_lvl1;
      let times = data.times;
      let values = data.values;
      let markData = [];
      for (let i = 0; i < buy_lvl1.length; i++) {
        if (buy_lvl1[i] == true) {
          markData.push({
            name: "买点",
            coord: [times[i], "" + values[i][1] * 1.01],
            value: "买",
            itemStyle: {
              color: "red",
            },
          });
        }

        
        if (sell_lvl1[i] == true) {
          markData.push({
            name: "卖点",
            coord: [times[i], "" + values[i][1] * 1.01],
            value: "卖",
            itemStyle: {
              color: "green",
            },
          });
        }
      }
      return markData;
    },

    drawChart(data, res) {
      // 基于准备好的dom，初始化echarts实例
      console.log(data);
      let myChart = this.$echarts.init(document.getElementById("myChart"), "");
      let macd = data.extra.macd;
      let rsi1 = data.extra.rsi.rsi1;
      let rsi2 = data.extra.rsi.rsi2;
      let rsi3 = data.extra.rsi.rsi3;
      let k = data.extra.kdj.k;
      let d = data.extra.kdj.d;
      let j = data.extra.kdj.j;

      let markData = this.getMark(data);

      let option = {
        animation: false,
        legend: {
          bottom: 10,
          left: "center",
          data: [
            this.code,
            "MA5",
            "MA10",
            "MA20",
            "MA30",
            "Volume",
            "MACD",
            "RSI1",
            "RSI2",
            "RSI3",
            "K",
            "D",
            "J",
          ],
        },
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "cross",
          },
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 10,
          textStyle: {
            color: "#000",
          },
          position: function (pos, params, el, elRect, size) {
            var obj = { top: 10 };
            obj[["left", "right"][+(pos[0] < size.viewSize[0] / 2)]] = 30;
            return obj;
          },
          // extraCssText: 'width: 170px'
        },
        axisPointer: {
          link: { xAxisIndex: "all" },
          label: {
            backgroundColor: "#777",
          },
        },
        toolbox: {
          feature: {
            dataZoom: {
              yAxisIndex: false,
            },
            brush: {
              type: ["lineX", "clear"],
            },
          },
        },
        brush: {
          xAxisIndex: "all",
          brushLink: "all",
          outOfBrush: {
            colorAlpha: 0.1,
          },
        },
        visualMap: {
          show: false,
          seriesIndex: 5,
          dimension: 2,
          pieces: [
            {
              value: 1,
              color: this.downColor,
            },
            {
              value: -1,
              color: this.upColor,
            },
          ],
        },
        grid: [
          {
            left: "10%",
            right: "8%",
            height: "30%",
          },
          {
            left: "10%",
            right: "8%",
            top: "30%",
            height: "10%",
          },
          {
            left: "10%",
            right: "8%",
            top: "60%", //MACD 指标
            height: "20%",
          },
          {
            left: "10%",
            right: "8%",
            top: "40%",
            height: "10%",
          },
          {
            left: "10%",
            right: "8%",
            top: "50%",
            height: "10%",
          },
        ],
        xAxis: [
          {
            type: "category",
            data: data.times,
            scale: true,
            boundaryGap: false,
            axisLine: { onZero: false },
            splitLine: { show: false },
            splitNumber: 20,
            min: "dataMin",
            max: "dataMax",
            axisPointer: {
              z: 100,
            },
          },
          {
            type: "category",
            gridIndex: 1,
            data: data.times,
            scale: true,
            boundaryGap: false,
            axisLine: { onZero: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            splitNumber: 20,
            min: "dataMin",
            max: "dataMax",
          },
          {
            //幅图
            type: "category",
            gridIndex: 2,
            data: data.times,
            boundaryGap: false,
            scale: true,
            splitNumber: 20,
            axisLine: { onZero: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            min: "dataMin",
            max: "dataMax",
          },
          {
            //幅图
            type: "category",
            gridIndex: 3,
            data: data.times,
            boundaryGap: false,
            scale: true,
            splitNumber: 20,
            axisLine: { onZero: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            min: "dataMin",
            max: "dataMax",
          },
          {
            //幅图
            type: "category",
            gridIndex: 4,
            data: data.times,
            boundaryGap: false,
            scale: true,
            splitNumber: 20,
            axisLine: { onZero: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            min: "dataMin",
            max: "dataMax",
          },
        ],
        yAxis: [
          {
            scale: true,
            splitArea: {
              show: true,
            },
          },
          {
            scale: true,
            gridIndex: 1,
            splitNumber: 2,
            axisLabel: { show: false },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
          {
            //幅图
            z: 4,
            gridIndex: 2,
            splitNumber: 4,
            axisLine: {
              onZero: false,
            },
            axisTick: {
              show: false,
            },
            splitLine: {
              show: false,
            },
            axisLabel: {
              //label文字设置
              color: "#c7c7c7",
              inside: true, //label文字朝内对齐
              fontSize: 8,
            },
          },
          {
            //幅图RSI
            z: 4,
            gridIndex: 3,
            splitNumber: 4,
            axisLine: {
              onZero: false,
            },
            axisTick: {
              show: false,
            },
            splitLine: {
              show: false,
            },
            axisLabel: {
              //label文字设置
              color: "#c7c7c7",
              inside: true, //label文字朝内对齐
              fontSize: 8,
            },
          },
          {
            //幅图KDJ
            z: 4,
            gridIndex: 4,
            splitNumber: 4,
            axisLine: {
              onZero: false,
            },
            axisTick: {
              show: false,
            },
            splitLine: {
              show: false,
            },
            axisLabel: {
              //label文字设置
              color: "#c7c7c7",
              inside: true, //label文字朝内对齐
              fontSize: 8,
            },
          },
        ],
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: [0, 1, 2, 3, 4],
            start: 50,
            end: 100,
          },
          {
            show: true,
            xAxisIndex: [0, 1, 2, 3, 4],
            type: "slider",
            top: "85%",
            start: 50,
            end: 100,
          },
        ],
        series: [
          {
            name: this.code,
            type: "candlestick",
            data: data.values,
            itemStyle: {
              color: this.upColor,
              color0: this.downColor,
              borderColor: null,
              borderColor0: null,
            },
            markPoint: {
              label: {
                normal: {
                  formatter: function (param) {
                    return param != null ? param.value : "";
                  },
                },
              },
              data: markData,
              tooltip: {
                formatter: function (param) {
                  return param.name + "<br>" + (param.data.coord || "");
                },
              },
            },
            tooltip: {
              formatter: function (param) {
                param = param[0];
                return [
                  "Date: " + param.name + '<hr size=1 style="margin: 3px 0">',
                  "Open: " + param.data[0] + "<br/>",
                  "Close: " + param.data[1] + "<br/>",
                  "Lowest: " + param.data[2] + "<br/>",
                  "Highest: " + param.data[3] + "<br/>",
                ].join("");
              },
            },
          },
          {
            name: "MA5",
            type: "line",
            data: this.calculateMA(5, data),
            smooth: true,
            showSymbol: false,
            lineStyle: {
              opacity: 0,
            },
          },
          {
            name: "MA10",
            type: "line",
            data: this.calculateMA(10, data),
            smooth: true,
            showSymbol: false,
            lineStyle: {
              opacity: 0,
            },
          },
          {
            name: "MA20",
            type: "line",
            data: this.calculateMA(20, data),
            smooth: true,
            showSymbol: false,
            lineStyle: {
              opacity: 0,
            },
          },
          {
            name: "MA30",
            type: "line",
            data: this.calculateMA(30, data),
            smooth: true,
            showSymbol: false,
            lineStyle: {
              opacity: 0,
            },
          },
          {
            name: "Volume",
            type: "bar",
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: data.volumes,
          },
          {
            name: "MACD",
            type: "bar",
            xAxisIndex: 2,
            yAxisIndex: 2,
            data: macd.macd,
            barWidth: "40%",
            itemStyle: {
              normal: {
                color: (params) => {
                  var colorList;
                  if (params.data >= 0) {
                    colorList = this.upColor;
                  } else {
                    colorList = this.downColor;
                  }
                  return colorList;
                },
              },
            },
          },
          {
            name: "DIF",
            type: "line",
            symbol: "none",
            xAxisIndex: 2,
            yAxisIndex: 2,
            data: macd.dif,
            lineStyle: {
              normal: {
                color: "#da6ee8",
                width: 1,
              },
            },
          },
          {
            name: "DEA",
            type: "line",
            symbol: "none",
            xAxisIndex: 2,
            yAxisIndex: 2,
            data: macd.dea,
            lineStyle: {
              normal: {
                opacity: 0.8,
                color: "#39afe6",
                width: 1,
              },
            },
          },
          {
            name: "RSI1",
            type: "line",
            symbol: "none",
            xAxisIndex: 3,
            yAxisIndex: 3,
            data: rsi1,
          },
          {
            name: "RSI2",
            type: "line",
            symbol: "none",
            xAxisIndex: 3,
            yAxisIndex: 3,
            data: rsi2,
          },
          {
            name: "RSI3",
            type: "line",
            symbol: "none",
            xAxisIndex: 3,
            yAxisIndex: 3,
            data: rsi3,
          },
          {
            name: "K",
            type: "line",
            symbol: "none",
            xAxisIndex: 4,
            yAxisIndex: 4,
            data: k,
          },
          {
            name: "D",
            type: "line",
            symbol: "none",
            xAxisIndex: 4,
            yAxisIndex: 4,
            data: d,
          },
          {
            name: "J",
            type: "line",
            symbol: "none",
            xAxisIndex: 4,
            yAxisIndex: 4,
            data: j,
          },
        ],
      };
      // 绘制图表
      myChart.setOption(option, true);
    },
    calculateMA(dayCount, data) {
      var result = [];
      for (var i = 0, len = data.values.length; i < len; i++) {
        if (i < dayCount) {
          result.push("-");
          continue;
        }
        var sum = 0;
        for (var j = 0; j < dayCount; j++) {
          sum += data.values[i - j][1];
        }
        result.push(+(sum / dayCount).toFixed(3));
      }
      return result;
    },
    splitData(rawData) {
      var times = [];
      var values = [];
      var volumes = [];
      for (var i = 0; i < rawData.length; i++) {
        console.log(rawData[i]);
        times.push(rawData[i].splice(0, 1)[0]);
        values.push(rawData[i]);
        volumes.push([
          i,
          rawData[i][4],
          rawData[i][0] > rawData[i][1] ? 1 : -1,
        ]);
      }

      return {
        times: times,
        values: values,
        volumes: volumes,
      };
    },
    splitData1(rawData) {
      var times = [];
      var values = [];
      var volumes = [];
      let i = 0;
      for (let item of rawData) {
        times.push(item["time"].slice(0, 10));
        let value = [
          item.openPrice,
          item.closePrice,
          item.lowPrice,
          item.highPrice,
          item.volume.low,
        ];
        values.push(value);
        volumes.push([i, value[4], value[0] > value[1] ? 1 : -1]);
        i++;
      }

      return {
        times: times,
        values: values,
        volumes: volumes,
      };
    },
  },
};
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
.el-input {
  display: inline;
}

.el-button {
  margin-top: 20px;
}

/deep/ #stock {
  display: inline;
}

/deep/ #market {
  width: 70px;
  margin-left: 10px;
}

/deep/ #code {
  width: 100px;
  margin-left: 5px;
}

/deep/ #err {
  color: firebrick;
  margin-left: 15px;
}

#output {
  font-size: 14px;
  text-align: left;
  margin-top: 20px;
  #content {
    padding: 30px;
    border: 1px solid #d8dfe6;
  }
}
</style>