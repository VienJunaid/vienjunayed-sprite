import { mount } from 'svelte'
import '../app.css'
import Importer from './Importer.svelte'

document.documentElement.classList.add('importer')
mount(Importer, { target: document.getElementById('app')! })
