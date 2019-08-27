import Vue from 'vue'
import VueRouter from 'vue-router'
import axios from '@/axios-auth'
import routes from '@/routes'

Vue.use(VueRouter)

let authURL: string
let payAPIURL: string
let authAPIURL: string

axios.defaults.baseURL = process.env.VUE_APP_API_URL
console.log(`Set axios.defaults.baseURL to: ${axios.defaults.baseURL}`)

authURL = process.env.VUE_APP_AUTH_URL
console.log(`Set authURL to: ${authURL}`)

authAPIURL = process.env.VUE_APP_AUTH_API_URL
console.log(`Set authAPIURL to: ${authAPIURL}`)

payAPIURL = process.env.VUE_APP_PAY_API_URL
console.log(`Set payAPIURL to: ${payAPIURL}`)

window['addressCompleteKey'] = process.env.VUE_APP_ADDRESS_COMPLETE_KEY
console.log('Set addressCompleteKey')

// inject properties into global namespace
Vue.mixin({
  data: function () {
    return {
      get authURL () {
        return authURL
      },
      get authAPIURL () {
        return authAPIURL
      },
      get payAPIURL () {
        return payAPIURL
      }
    }
  }
})

// create router
let router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: routes
})

// if there is no Keycloak token, redirect to Auth URL
router.afterEach((to, from) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    console.log('redirect check ', sessionStorage.getItem('REDIRECTED'))
    if (sessionStorage.getItem('REDIRECTED') !== 'true') {
      let auth = sessionStorage.getItem('KEYCLOAK_TOKEN')
      if (auth) {
        console.log('AUTH PASSED')
      } else {
        console.log('AUTH FAILED')
        sessionStorage.setItem('REDIRECTED', 'true')
        window.location.href = authURL
      }
    }
  }
})

export default router
