<template>
  <div>
    <v-expansion-panel v-if="taskItems && taskItems.length > 0">
      <v-expansion-panel-content
        class="todo-list"
        v-for="(item, index) in orderBy(taskItems, 'order')"
        v-bind:key="index"
        expand-icon=""
        :class="{ 'disabled': !item.enabled }">

        <template v-slot:header>
          <div class="list-item">
            <div class="list-item__title">{{item.title}}</div>

            <div class="list-item__subtitle" v-if="isNew(item)">
              <span v-if="item.subtitle">{{item.subtitle}}</span>
            </div>
            <template v-else>
              <div class="list-item__status1">
                <span v-if="isDraft(item)">DRAFT</span>
                <span v-else-if="isPending(item)">FILING PENDING</span>
                <span v-else-if="isError(item)">FILING PENDING</span>
              </div>

              <div class="list-item__status2">
                <span v-if="isPending(item)">
                  PAYMENT INCOMPLETE<v-btn flat icon color="black"><v-icon>info_outline</v-icon></v-btn>
                </span>
                <span v-else-if="isError(item)">
                  PAYMENT UNSUCCESSFUL<v-btn flat icon color="black"><v-icon>info_outline</v-icon></v-btn>
                </span>
              </div>
            </template>

            <div class="list-item__actions">
              <v-btn color="primary" v-if="isDraft(item)" :disabled="!item.enabled"
                @click.native.stop="doResumeFiling(item)">Resume</v-btn>
              <v-btn color="primary" v-else-if="isPending(item)" :disabled="!item.enabled"
                @click.native.stop="doResumePayment(item)">Resume Payment</v-btn>
              <v-btn color="primary" v-else-if="isError(item)" :disabled="!item.enabled"
                @click.native.stop="doResumePayment(item)">Retry Payment</v-btn>
              <v-btn color="primary" v-else-if="!isCompleted(item)" :disabled="!item.enabled"
                @click.native.stop="doFileNow(item)">File Now</v-btn>
            </div>
          </div>
        </template>

        <v-card v-if="isPending(item)">
          <v-card-text>
            <p class="bold">Payment Incomplete</P>
            <p>This filing is pending payment. The payment may still be in progress or may have been
              interrupted for some reason.<p>
            <p>You may continue this filing by selecting "Resume Payment".</p>
          </v-card-text>
        </v-card>

        <v-card v-if="isError(item)">
          <v-card-text>
            <p class="bold">Payment Unsuccessful</p>
            <p>This filing is pending payment. The payment appears to have been unsuccessful for some
              reason.</p>
            <p>You may continue this filing by selecting "Retry Payment".</p>
          </v-card-text>
        </v-card>

      </v-expansion-panel-content>
    </v-expansion-panel>

    <!-- No Results Message -->
    <v-card class="no-results" flat v-if="taskItems && taskItems.length === 0 && !errorMessage">
      <v-card-text>
        <div class="no-results__title">You don't have anything to do yet</div>
        <div class="no-results__subtitle">Filings that require your attention will appear here</div>
      </v-card-text>
    </v-card>

    <!-- Error Message -->
    <v-card class="network-error" flat v-if="taskItems && taskItems.length === 0 && errorMessage">
      <v-card-text>
        <div class="network-error__title">{{errorMessage}}</div>
        <div class="network-error__subtitle">Filings that require your attention will normally appear here</div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script lang="ts">
import Vue2Filters from 'vue2-filters'
import axios from '@/axios-auth'
import { mapState, mapActions } from 'vuex'

export default {
  name: 'TodoList',

  mixins: [Vue2Filters.mixin],

  data () {
    return {
      taskItems: null,
      errorMessage: null
    }
  },

  computed: {
    ...mapState(['corpNum'])
  },

  mounted () {
    // load data for this page
    this.getTasks()
  },

  methods: {
    ...mapActions(['setARFilingYear', 'setCurrentFilingStatus', 'setRegOffAddrChange', 'setAgmDate',
      'setFiledDate', 'setNoAGM', 'setValidated']),

    getTasks () {
      this.taskItems = []
      this.errorMessage = null
      if (this.corpNum) {
        const url = this.corpNum + '/tasks'
        axios.get(url).then(response => {
          if (response && response.data && response.data.tasks) {
            // create task items
            response.data.tasks.forEach(task => {
              if (task && task.task && task.task.todo) {
                this.loadTodoItem(task)
              } else if (task && task.task && task.task.filing) {
                this.loadFilingItem(task)
              } else {
                console.log('ERROR - got unknown task =', task)
              }
            })
          } else {
            console.log('getTasks() error - invalid response =', response)
            this.errorMessage = 'Oops, could not parse data from server'
          }
          this.$emit('todo-count', this.taskItems.length)

          // if this is a draft/pending/error item, emit the has-blocker-filings event to the parent component
          // this indicates that a new filing cannot be started because this one has to be completed first
          this.$emit('has-blocker-filing',
            this.taskItems.filter(elem => {
              return this.isDraft(elem) || this.isPending(elem) || this.isError(elem)
            }).length > 0
          )
        }).catch(error => {
          console.error('getTasks() error =', error)
          this.errorMessage = 'Oops, could not load data from server'
        })
      }
    },

    loadTodoItem (task) {
      const todo = task.task.todo
      if (todo && todo.header) {
        switch (todo.header.name) {
          case 'annualReport': {
            const ARFilingYear = todo.header.ARFilingYear
            this.taskItems.push({
              type: todo.header.name,
              title: `File ${ARFilingYear} Annual Report`,
              subtitle: task.enabled ? '(including Address and/or Director Change)' : null,
              ARFilingYear,
              status: todo.header.status || 'NEW',
              enabled: Boolean(task.enabled),
              order: task.order
            })
            break
          }
          default:
            console.log('ERROR - got unknown todo item =', todo)
            break
        }
      } else {
        console.log('ERROR - invalid todo or header in task =', task)
      }
    },

    loadFilingItem (task) {
      const filing = task.task.filing
      if (filing && filing.header) {
        switch (filing.header.name) {
          case 'annualReport':
            this.loadAnnualReport(task)
            break
          case 'changeOfDirectors':
            this.loadChangeOfDirectors(task)
            break
          case 'changeOfAddress':
            this.loadChangeOfAddress(task)
            break
          default:
            console.log('ERROR - got unknown filing item =', filing)
            break
        }
      } else {
        console.log('ERROR - invalid filing or header in task =', task)
      }
    },

    loadAnnualReport (task) {
      const filing = task.task.filing
      if (filing && filing.header && filing.annualReport) {
        const date = filing.annualReport.annualGeneralMeetingDate
        if (date) {
          const ARFilingYear = +date.substring(0, 4)
          this.taskItems.push({
            type: filing.header.name,
            id: filing.header.filingId,
            title: `File ${ARFilingYear} Annual Report`,
            ARFilingYear,
            status: filing.header.status || 'NEW',
            enabled: Boolean(task.enabled),
            order: task.order,
            paymentToken: filing.header.paymentToken ? filing.header.paymentToken : null
          })
        } else {
          console.log('ERROR - invalid date in filing =', filing)
        }
      } else {
        console.log('ERROR - invalid filing or header or annualReport in task =', task)
      }
    },

    loadChangeOfDirectors (task) {
      const filing = task.task.filing
      if (filing && filing.header && filing.changeOfDirectors) {
        this.taskItems.push({
          type: filing.header.name,
          id: filing.header.filingId,
          title: `File Director Change`,
          status: filing.header.status || 'NEW',
          enabled: Boolean(task.enabled),
          order: task.order,
          paymentToken: filing.header.paymentToken ? filing.header.paymentToken : null
        })
      } else {
        console.log('ERROR - invalid filing or header or changeOfDirectors in task =', task)
      }
    },

    loadChangeOfAddress (task) {
      const filing = task.task.filing
      if (filing && filing.header && filing.changeOfAddress) {
        this.taskItems.push({
          type: filing.header.name,
          id: filing.header.filingId,
          title: `File Address Change`,
          status: filing.header.status || 'NEW',
          enabled: Boolean(task.enabled),
          order: task.order,
          paymentToken: filing.header.paymentToken ? filing.header.paymentToken : null
        })
      } else {
        console.log('ERROR - invalid filing or header or changeOfAddress in task =', task)
      }
    },

    doFileNow (item) {
      switch (item.type) {
        case 'annualReport':
          // file the subject Annual Report
          this.resetStore(item)
          this.$router.push({ name: 'annual-report', params: { id: '0' } }) // '0' means "new AR"
          break
        default:
          console.log('doFileNow(), invalid type for item =', item)
      }
    },

    doResumeFiling (item) {
      switch (item.type) {
        case 'annualReport':
          // resume the subject Annual Report
          this.resetStore(item)
          this.setCurrentFilingStatus('DRAFT')
          this.$router.push({ name: 'annual-report', params: { id: item.id } })
          break
        case 'changeOfDirectors':
          // resume the subject Change Of Directors
          this.resetStore(item)
          this.setCurrentFilingStatus('DRAFT')
          this.$router.push({ name: 'standalone-directors', params: { id: item.id } })
          break
        case 'changeOfAddress':
          // resume the subject Change Of Address
          this.resetStore(item)
          this.setCurrentFilingStatus('DRAFT')
          this.$router.push({ name: 'standalone-addresses', params: { id: item.id } })
          break
        default:
          console.log('doFileNow(), invalid type for item =', item)
      }
    },

    // this is called to either Resume Payment or Retry Payment.
    doResumePayment (item) {
      const origin = window.location.origin || ''
      const filingId = item.id
      const returnURL = encodeURIComponent(origin + '/Dashboard?filing_id=' + filingId)
      let authStub: string = this.authURL || ''
      if (!(authStub.endsWith('/'))) { authStub += '/' }
      const paymentToken = item.paymentToken
      const payURL = authStub + 'makepayment/' + paymentToken + '/' + returnURL
      window.location.assign(payURL)
    },

    resetStore (item) {
      this.setARFilingYear(item.ARFilingYear)
      this.setCurrentFilingStatus('NEW')
      this.setRegOffAddrChange(false)
      this.setAgmDate(null)
      this.setFiledDate(null)
      this.setNoAGM(false)
      this.setValidated(false)
    },

    isNew (item) {
      return item.status === 'NEW'
    },

    isDraft (item) {
      return item.status === 'DRAFT'
    },

    isPending (item) {
      return item.status === 'PENDING'
    },

    isError (item) {
      return item.status === 'ERROR'
    },

    isCompleted (item) {
      return item.status === 'COMPLETED'
    }
  },

  watch: {
    corpNum (val) {
      // if Corp Num changes, get new tasks
      this.getTasks()
    }
  }
}
</script>

<style lang="stylus" scoped>
@import "../../assets/styles/theme.styl"

.todo-list
  // disable expansion
  pointer-events none

.todo-list .list-item
  padding 0

  .list-item__title
    width 25%

  .list-item__subtitle
    font-size 0.75rem

  .list-item__status1
    width 20%
    color $gray7

  .list-item__status2
    width 36%
    color $gray7

    .v-btn
      margin 0

  .list-item__actions
    .v-btn
      min-width 142px

.todo-list.disabled
  background-color $gray0

  .list-item__title,
  .list-item__subtitle,
  .list-item__status1,
  .list-item__status2
    color $gray6

    .v-btn
      // enable expansion buttons
      pointer-events auto

.todo-list:not(.disabled)
  .v-btn
    // enable action buttons
    pointer-events auto

p.bold
  font-weight 500
</style>
