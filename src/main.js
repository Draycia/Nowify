import Vue from 'vue'
import App from './App.vue'
import Vue2TouchEvents from 'vue2-touch-events'
import { BootstrapVue, IconsPlugin, BProgress, BProgressBar } from 'bootstrap-vue'

import '@/styles/global/reset.scss'
import '@/styles/global/app.scss'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

Vue.config.productionTip = false
Vue.use(Vue2TouchEvents)

Vue.use(BootstrapVue)
Vue.use(IconsPlugin)
Vue.component('b-progress', BProgress)
Vue.component('b-progress-bar', BProgressBar)

new Vue({
  render: h => h(App)
}).$mount('#app')
