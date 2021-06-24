import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import * as echarts from 'echarts';
import axios from 'axios' // 修改原型链，在main.js中引入axios

Vue.prototype.$ajax = axios // 将axios改写为Vue的原型属性
Vue.prototype.$echarts = echarts;
Vue.config.productionTip = false
Vue.use(ElementUI);

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')


