import { queryElement, queryElementAll } from '../../../common/utilities/query';

/**
 * Component loader for a standard form container. Currently only needs to
 * support "required" input annotations for clearer user experience.
 *
 * @remarks
 * Could be accomplished in templating rather than as an external script here
 */
export default function formsLoader(): void {
    const formContainer = queryElement(
        document,
        '#form-container',
        HTMLDivElement,
    );
    const inputs = queryElementAll(
        formContainer,
        'input[required]',
        HTMLInputElement,
    );
    const textareas = queryElementAll(
        formContainer,
        'textarea[required]',
        HTMLTextAreaElement,
    );

    [...inputs, ...textareas].forEach((input) => {
        const label = input.previousElementSibling;
        if (label) label.innerHTML += '<span style="color:red">&nbsp;*</span>';
    });
}
