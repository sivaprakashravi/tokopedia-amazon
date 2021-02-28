const { host, login, dbHost, jQ } = require('./../constants/defaults');
const cron = require('node-cron');
const axios = require('axios');
const { scrapper } = require('./scraping-handler');
const jobRunTypes = [
    {
        schedule: '0 1 * * *',
        mode: 'Everyday'
    },
    {
        schedule: '0 0 * * 1',
        mode: 'Once in a Week'
    },
    {
        schedule: '0 0 * 1 *',
        mode: 'Once in a Month'
    },
    {
        schedule: '0 0 * * 1,4',
        mode: 'Twice in a Week'
    },
    {
        schedule: '0 0 * 1, 15 *',
        mode: 'Twice in a Month'
    }
]
// ['Everyday', 'Once in a Week', 'Once in a Month', 'Twice in a Week', 'Twice in a Month'];
const job = async () => {
    testCron();
    let jobs = await axios.get('http://localhost:8001/job/all').then(async (res) => {
        return res.data.data;
    });
    jobs = jobs.map(j => {
        const definedJob = jobRunTypes.find(jr => jr.mode === j.interval);
        if (definedJob) {
            j.runAt = definedJob.schedule;
        } else {
            j.runAt = '0 1 * * *';
            j.destroy = true;
        }
        return j;
    })
    console.log('Job Scheduler Running');
    scheduleJob(jobs);

    // console.log('Triggered Job Completed');
}

const scheduleJob = async (jobs) => {
    async function jobLoop() {
        const noOfjobs = jobs.length;
        for (let index = 0; index < noOfjobs; index++) {
            const sJob = jobs[index];
            const { nId, subCategory } = sJob;
            sJob.task = new cron.schedule(sJob.runAt, async () => {
                console.log(`${sJob.runAt} - ${sJob.interval}`);
                console.log(`running a task --> ${sJob.interval}`);
                let url = `${host}/s?bbn=${nId}&rh=n:${nId},n:${subCategory.nId}`;
                if (subCategory.subCategory && !subCategory.subCategory.node) {
                    url = `${url},n:${subCategory.subCategory.nId}`;
                }
                if (subCategory.subCategory.node) {
                    url = `${host}/s?node=${subCategory.subCategory.node}`;
                }
                sJob.url = url;
                const jobDone = await scrapper(sJob);
                return jobDone;
            });
        }
    }
    async function destroyLoop() {
        const noOfjobs = jobs.length;
        for (let index = 0; index < noOfjobs; index++) {
            const sJob = jobs[index];
            if (sJob && sJob.destroy && sJob.task) {
                sJob.task.destroy();
            }
        }
    }
    await jobLoop();
    await destroyLoop();
    return true;
}

const testCron = async() => {
    console.log('Testing Cron');
    new cron.schedule('0 0 0 * * *', async () => {
        let jobs = await axios.get('http://localhost:8001/job/all').then(async (res) => {
            return res.data.data;
        });
        jobs = [jobs[0]];
        jobs = jobs.map(j => {
            j.runAt = '0 0 */1 * * *';
            j.destroy = true;
            return j;
        })
        console.log('Job Scheduler Running');
        scheduleJob(jobs);
    });
}

new cron.schedule('0 0 0 * * *', function () {
    job();
});

module.exports = { job };