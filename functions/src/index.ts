import * as functions from 'firebase-functions';
import * as express from 'express';
import * as requst from 'request-promise';

const app = express();

export const api = functions.https.onRequest(app);

const API_ENDPOINT : string = 'https://002-iz.impfterminservice.de/';

enum API_FUNCTION {
    LIST_CENTERS = 'assets/static/impfzentren.json',
    TEST_VACCINATION_CAPACITY = 'rest/suche/termincheck?plz={0}&leistungsmerkmale=L920,L921,L922,L923'
}

enum State {
    BW = 'Baden-Württemberg'
}

interface VaccinationCenter {
    name: string,
    plz: string,
    city: string,
    state: string,
    url: string,
    address: string,
    capacity: Capacity|Error|null
}

interface Capacity {
    capacity_free: boolean,
    metrics: object|null
}

interface Error {
    code: number,
    message: string
}

/** Out app functions */
app.get('/', async(req, res) => {
    let centers = await get_all_vaccination_center_capacity(State.BW);

    if(centers == null)
    {
        res.json({});
        return;
    }

    res.json(centers);
});

app.get('/:num/:plz', async(req, res) => {
    let c = {
        name: "",
        plz: req.params.plz,
        city: "",
        state: "",
        url: `https://00${req.params.num}-iz.impfterminservice.de/`,
        address: "",
        capacity: null
    };

    res.json(await get_vaccination_center_capacity(c));
});

/** Api fetch functions */

const get_vaccination_centers = async (state: State) : Promise<VaccinationCenter[]|null>  => {
    let data = await fetch_json(API_FUNCTION.LIST_CENTERS);

    if(data[state] == null)
    {
        return null;
    }

    let centers : VaccinationCenter[] = [];


    for(let center of data[state])
    {
        let c : VaccinationCenter =
        {
            name: center['Zentrumsname'],
            plz: center['PLZ'],
            city: center['Ort'],
            state: center['Bundesland'],
            url: center['URL'],
            address: center['Adresse'],
            capacity: null
        } ;
        centers.push(c);
    }
    return centers;
}

const get_all_vaccination_center_capacity = async (state: State) : Promise<VaccinationCenter[]|null> => {
    let centers = await get_vaccination_centers(state);
    if(centers == null)
    {
        return null;
    }

    for(let c of centers)
    {
        c.capacity = await get_vaccination_center_capacity(c);
    }
    return centers;
}

const get_vaccination_center_capacity = async(center: VaccinationCenter) : Promise<Capacity|Error> => {
    
    try {
        let data = await fetch_json(API_FUNCTION.TEST_VACCINATION_CAPACITY, [center.plz], center.url);
        if(Object.entries(data).length == 0)
        {
            return {
                code: 502,
                message: "Empty Response received!"
            } ;
        }

        return {
            capacity_free: data['termineVorhanden'],
            metrics: data['vorhandeneLeistungsmerkmale']
        };
    } catch(e) {
        return {
            code: e.statusCode,
            message: e.message
        } ;
    }
}

/** Util functions */

const fetch_json = async (api_function: API_FUNCTION, option: (string[] | null) = null, endpoint: string = API_ENDPOINT) =>
{
    let url = endpoint + api_function;

    if(option != null)
    {
        url = format_string(url, option);
    }

    console.debug(`Fetching JSON from ${url}`);
    return await requst(url, {json: true});
}
const format_string = (str: string, args: string[]) : string => {
    var ret = str;
    for(var k in args)
    {
        ret = ret.replace(new RegExp(`\\{${k}\\}`, 'g'), args[k]);
    }
    return ret;
}
